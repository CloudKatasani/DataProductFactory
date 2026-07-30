import type { Prisma } from "@prisma/client";
import { GateMode, GateStatus, type Role } from "@/lib/artifacts/enums";
import { getStage, stageAllowsAutomation } from "@/lib/lifecycle/stages";
import { recordAudit } from "./audit";
import { GovernanceError, roleNotHeld } from "./errors";
import { evaluateQuorum, type ApprovalRecord } from "./quorum";

/**
 * ============================================================================
 * THE APPROVAL CHOKE POINT (CLAUDE.md non-negotiable 2)
 * ============================================================================
 * `approveGate` below is the ONLY function in this codebase that may write
 * "APPROVED" to Gate.status. Everything else must go through `setGateStatus`,
 * which refuses that value outright.
 *
 * tests/unit/governance/approval-path.test.ts greps the source tree and fails if
 * a second write site appears. If you are here because that test is failing:
 * route your change through approveGate rather than widening the exception list.
 */

/** Statuses any caller may set. Note the absence of APPROVED. */
export type SettableGateStatus = Exclude<GateStatus, "APPROVED">;

export interface SetGateStatusInput {
  gateId: string;
  to: SettableGateStatus;
  actorId: string;
  workspaceId: string;
  productId: string;
  reason?: string;
}

/**
 * Ordinary gate transitions: DRAFT, IN_REVIEW, CHANGES_REQUESTED, STALE.
 * Rejects APPROVED at runtime as well as in the type, because a `as never` cast
 * or a value arriving from JSON would otherwise slip past the compiler.
 */
export async function setGateStatus(
  tx: Prisma.TransactionClient,
  input: SetGateStatusInput,
): Promise<void> {
  if ((input.to as GateStatus) === "APPROVED") {
    throw new GovernanceError(
      "setGateStatus cannot approve a gate. Approval requires an authenticated approver and runs through approveGate.",
      "NOT_AUTHORIZED",
    );
  }
  GateStatus.parse(input.to);

  const gate = await tx.gate.update({
    where: { id: input.gateId },
    data: { status: input.to, stalenessReason: input.to === "STALE" ? (input.reason ?? null) : null },
  });

  await recordAudit(tx, {
    workspaceId: input.workspaceId,
    productId: input.productId,
    actorId: input.actorId,
    type: "GATE_STATUS_CHANGED",
    payload: { gateId: gate.id, stageNumber: gate.stageNumber, to: input.to, reason: input.reason },
  });
}

export interface ApproveGateInput {
  gateId: string;
  /** Authenticated user id. Never accepted from the client. */
  actorId: string;
  /** Role the actor is exercising; verified against RoleAssignment. */
  actorRole: Role;
  workspaceId: string;
  workspaceSlug: string;
  productId: string;
  /** Hash of the artifact version under review. Approvals bind to a hash. */
  currentArtifactHash: string;
  artifactVersionId: string;
  comment?: string;
}

export interface ApproveGateResult {
  /** True when this approval completed quorum and closed the gate. */
  gateClosed: boolean;
  missingRoles: Role[];
  vetoedBy: Role[];
}

/**
 * Record a human approval and, if that completes quorum, close the gate.
 *
 * There is no AI path into this function: it requires an `actorId` that resolves
 * to a real User row holding `actorRole` in the workspace. The AI assistant has
 * no user identity and therefore cannot reach it.
 */
export async function approveGate(
  tx: Prisma.TransactionClient,
  input: ApproveGateInput,
): Promise<ApproveGateResult> {
  const held = await tx.roleAssignment.findFirst({
    where: { userId: input.actorId, workspaceId: input.workspaceId, role: input.actorRole },
  });
  if (!held) {
    throw roleNotHeld(input.actorRole, input.workspaceSlug);
  }

  const gate = await tx.gate.findUniqueOrThrow({ where: { id: input.gateId } });
  const stage = getStage(gate.stageNumber);

  await tx.approval.create({
    data: {
      gateId: input.gateId,
      artifactVersionId: input.artifactVersionId,
      actorId: input.actorId,
      role: input.actorRole,
      decision: "APPROVE",
      artifactHash: input.currentArtifactHash,
      comment: input.comment ?? null,
    },
  });

  await recordAudit(tx, {
    workspaceId: input.workspaceId,
    productId: input.productId,
    actorId: input.actorId,
    type: "APPROVAL_RECORDED",
    payload: {
      gateId: input.gateId,
      stageNumber: gate.stageNumber,
      role: input.actorRole,
      decision: "APPROVE",
      artifactHash: input.currentArtifactHash,
    },
  });

  const rows = await tx.approval.findMany({ where: { gateId: input.gateId } });
  const approvals: ApprovalRecord[] = rows.map((r) => ({
    role: r.role as Role,
    decision: r.decision as ApprovalRecord["decision"],
    artifactHash: r.artifactHash,
    createdAt: r.createdAt,
  }));

  const quorum = evaluateQuorum(stage.requiredApprovers, approvals, input.currentArtifactHash);
  if (!quorum.satisfied) {
    return { gateClosed: false, missingRoles: quorum.missingRoles, vetoedBy: quorum.vetoedBy };
  }

  // The one and only write of "APPROVED" in the codebase.
  await tx.gate.update({
    where: { id: input.gateId },
    data: { status: "APPROVED", stalenessReason: null },
  });

  await recordAudit(tx, {
    workspaceId: input.workspaceId,
    productId: input.productId,
    actorId: input.actorId,
    type: "GATE_STATUS_CHANGED",
    payload: { gateId: input.gateId, stageNumber: gate.stageNumber, to: "APPROVED" },
  });

  return { gateClosed: true, missingRoles: [], vetoedBy: [] };
}

export interface SetGateModeInput {
  gateId: string;
  mode: GateMode;
  /** Authenticated user id enabling/disabling automation. */
  actorId: string;
  workspaceId: string;
  workspaceSlug: string;
  productId: string;
}

/**
 * Set a gate's approval mode. Lives here because it mutates a Gate row and must
 * stay inside the one file the choke-point test allows to do so — but note it
 * only ever writes `mode`, never `status`, so it is not a path to APPROVED.
 *
 * Enabling AUTOMATED is a governed act: the gate must not carry a veto role, and
 * the actor must hold *every* required approver role. Automation is a standing
 * pre-approval, so the human enabling it must be authorized to fill every seat
 * it will later fill on their behalf (Non-Negotiable 2).
 */
export async function setGateMode(
  tx: Prisma.TransactionClient,
  input: SetGateModeInput,
): Promise<void> {
  GateMode.parse(input.mode);
  const gate = await tx.gate.findUniqueOrThrow({ where: { id: input.gateId } });
  const stage = getStage(gate.stageNumber);

  if (input.mode === "AUTOMATED") {
    if (!stageAllowsAutomation(gate.stageNumber)) {
      throw new GovernanceError(
        `Stage ${gate.stageNumber} carries a veto role and can never be automated — it always requires a human approver.`,
        "NOT_AUTHORIZED",
      );
    }
    const held = await tx.roleAssignment.findMany({
      where: {
        userId: input.actorId,
        workspaceId: input.workspaceId,
        role: { in: [...stage.requiredApprovers] },
      },
      select: { role: true },
    });
    const heldRoles = new Set(held.map((h) => h.role));
    const missing = stage.requiredApprovers.filter((r) => !heldRoles.has(r));
    if (missing.length > 0) {
      throw new GovernanceError(
        `You can only automate this gate if you hold every required approver role. You are missing: ${missing.join(", ")}.`,
        "NOT_AUTHORIZED",
      );
    }
  }

  await tx.gate.update({
    where: { id: input.gateId },
    data: {
      mode: input.mode,
      automationById: input.mode === "AUTOMATED" ? input.actorId : null,
      automationAt: input.mode === "AUTOMATED" ? new Date() : null,
    },
  });

  await recordAudit(tx, {
    workspaceId: input.workspaceId,
    productId: input.productId,
    actorId: input.actorId,
    type: "GATE_MODE_CHANGED",
    payload: { gateId: input.gateId, stageNumber: gate.stageNumber, mode: input.mode },
  });
}

export interface AutoApproveGateInput {
  gateId: string;
  workspaceId: string;
  workspaceSlug: string;
  productId: string;
  currentArtifactHash: string;
  artifactVersionId: string;
}

export interface AutoApproveResult {
  gateClosed: boolean;
  /** True when the gate was AUTOMATED and eligible and the path ran. */
  attempted: boolean;
  /** Why it did not run, when attempted is false. */
  reason?: string;
}

/**
 * The automated approval path. It does NOT write APPROVED itself: it fills each
 * required seat by calling `approveGate` on behalf of the human who enabled
 * automation, so the single choke point still writes the one and only APPROVED
 * (Non-Negotiable 2 holds — "exactly one code path" is literally still true).
 *
 * It is deliberately conservative: it no-ops (rather than throwing) whenever the
 * gate is not AUTOMATED, is a veto gate, or the enabling human no longer holds
 * every required role. In those cases the gate is simply left for manual review.
 */
export async function autoApproveGate(
  tx: Prisma.TransactionClient,
  input: AutoApproveGateInput,
): Promise<AutoApproveResult> {
  const gate = await tx.gate.findUniqueOrThrow({ where: { id: input.gateId } });
  if (gate.mode !== "AUTOMATED" || !gate.automationById) {
    return { gateClosed: false, attempted: false, reason: "gate is not automated" };
  }
  if (!stageAllowsAutomation(gate.stageNumber)) {
    return { gateClosed: false, attempted: false, reason: "veto gate cannot be automated" };
  }

  const stage = getStage(gate.stageNumber);
  const enablerId = gate.automationById;

  // Re-verify the enabler still holds every required role before acting — a role
  // may have been revoked since automation was switched on.
  const held = await tx.roleAssignment.findMany({
    where: {
      userId: enablerId,
      workspaceId: input.workspaceId,
      role: { in: [...stage.requiredApprovers] },
    },
    select: { role: true },
  });
  const heldRoles = new Set(held.map((h) => h.role));
  if (stage.requiredApprovers.some((r) => !heldRoles.has(r))) {
    return {
      gateClosed: false,
      attempted: false,
      reason: "the human who enabled automation no longer holds every required role",
    };
  }

  // Fill each required seat through the ordinary approval path. The last one
  // completes quorum and closes the gate inside approveGate.
  let result: ApproveGateResult = {
    gateClosed: false,
    missingRoles: [...stage.requiredApprovers],
    vetoedBy: [],
  };
  for (const role of stage.requiredApprovers) {
    result = await approveGate(tx, {
      gateId: input.gateId,
      actorId: enablerId,
      actorRole: role,
      workspaceId: input.workspaceId,
      workspaceSlug: input.workspaceSlug,
      productId: input.productId,
      currentArtifactHash: input.currentArtifactHash,
      artifactVersionId: input.artifactVersionId,
      comment: "Automated approval — gate configured for auto-approval; exit criteria met.",
    });
  }

  return { gateClosed: result.gateClosed, attempted: true };
}

export interface RecordReviewDecisionInput {
  gateId: string;
  actorId: string;
  actorRole: Role;
  workspaceId: string;
  workspaceSlug: string;
  productId: string;
  /** REJECT or REQUEST_CHANGES. APPROVE must go through approveGate. */
  decision: "REJECT" | "REQUEST_CHANGES";
  currentArtifactHash: string;
  artifactVersionId: string;
  comment?: string;
}

/**
 * Record a reviewer's non-approving decision. This lives in the same file as
 * approveGate on purpose: it is the only *other* thing that mutates a gate, and
 * keeping both here is what lets the choke-point test assert "one file mutates
 * gates". It never writes APPROVED — a rejection or change request moves the
 * gate to CHANGES_REQUESTED — so it cannot be a back door to approval.
 *
 * The approval row is append-only like every other: changing your mind later is
 * a new row, and quorum reads most-recent-wins.
 */
export async function recordReviewDecision(
  tx: Prisma.TransactionClient,
  input: RecordReviewDecisionInput,
): Promise<void> {
  const held = await tx.roleAssignment.findFirst({
    where: { userId: input.actorId, workspaceId: input.workspaceId, role: input.actorRole },
  });
  if (!held) {
    throw roleNotHeld(input.actorRole, input.workspaceSlug);
  }

  const gate = await tx.gate.findUniqueOrThrow({ where: { id: input.gateId } });

  await tx.approval.create({
    data: {
      gateId: input.gateId,
      artifactVersionId: input.artifactVersionId,
      actorId: input.actorId,
      role: input.actorRole,
      decision: input.decision,
      artifactHash: input.currentArtifactHash,
      comment: input.comment ?? null,
    },
  });

  await tx.gate.update({
    where: { id: input.gateId },
    data: { status: "CHANGES_REQUESTED" },
  });

  await recordAudit(tx, {
    workspaceId: input.workspaceId,
    productId: input.productId,
    actorId: input.actorId,
    type: "APPROVAL_RECORDED",
    payload: {
      gateId: input.gateId,
      stageNumber: gate.stageNumber,
      role: input.actorRole,
      decision: input.decision,
      artifactHash: input.currentArtifactHash,
    },
  });

  await recordAudit(tx, {
    workspaceId: input.workspaceId,
    productId: input.productId,
    actorId: input.actorId,
    type: "GATE_STATUS_CHANGED",
    payload: { gateId: input.gateId, stageNumber: gate.stageNumber, to: "CHANGES_REQUESTED" },
  });
}
