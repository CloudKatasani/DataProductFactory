import type { Prisma } from "@prisma/client";
import { GateStatus, type Role } from "@/lib/artifacts/enums";
import { getStage } from "@/lib/lifecycle/stages";
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
