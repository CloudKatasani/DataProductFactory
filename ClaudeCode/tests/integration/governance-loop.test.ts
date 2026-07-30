import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/client";
import { commitArtifact } from "@/lib/artifacts/commit";
import {
  DecisionRegisterBody,
  CharterBody,
  parseArtifactBody,
  renderCharterMarkdown,
} from "@/lib/artifacts/schemas";
import { approveGate, setGateStatus } from "@/lib/governance/gates";
import { GovernanceError } from "@/lib/governance/errors";
import { buildEvaluationContext, loadGateStatusByStage } from "@/lib/lifecycle/context";
import { assertCanEnterReview, evaluateStage, isStageUnlocked } from "@/lib/lifecycle/transition";
import {
  createProductWithGates,
  createUserWithRoles,
  createWorkspace,
  gateFor,
  latestVersionHash,
} from "./factory";

/**
 * The end-to-end proof that the domain composes: an artifact commit hashes,
 * versions, mirrors to disk and audits; the transition guard reads the same
 * criteria the UI does; the sole approval path closes a gate only at quorum;
 * and editing an approved upstream artifact cascades STALE downstream.
 *
 * Everything here runs against a real SQLite database and a real filesystem
 * mirror — no mocks — so a regression in any seam surfaces here.
 */

const COMPLETE_DECISION = {
  persona: "Regional dispatch supervisor",
  decision: "Which crew to send first when several outages are open",
  cadence: "Every 15 minutes during an event",
  consequence: "Crews idle while customers stay dark",
};

let workspace: Awaited<ReturnType<typeof createWorkspace>>;
let consumer: { id: string };
let owner: { id: string };
let architect: { id: string };

beforeAll(async () => {
  workspace = await createWorkspace("loop-ws");
  consumer = await createUserWithRoles(workspace.id, ["CONSUMER_REP"]);
  owner = await createUserWithRoles(workspace.id, ["PRODUCT_OWNER"]);
  architect = await createUserWithRoles(workspace.id, ["DOMAIN_ARCHITECT"]);
});

async function commitDecisionRegister(
  product: { id: string; slug: string },
  decisions: Array<typeof COMPLETE_DECISION>,
) {
  const body = parseArtifactBody("DECISION_REGISTER", { decisions });
  return commitArtifact({
    workspaceId: workspace.id,
    workspaceSlug: workspace.slug,
    productId: product.id,
    productSlug: product.slug,
    stageNumber: 1,
    kind: "DECISION_REGISTER",
    slug: "decision-register",
    format: "yaml",
    body,
    provenance: "HUMAN_AUTHORED",
    authorId: owner.id,
  });
}

describe("the stage-1 governance loop", () => {
  it("blocks entering review before the register and records exist", async () => {
    const product = await createProductWithGates(workspace.id, "loop-empty");
    const ctx = await buildEvaluationContext(product.id);
    const gates = await loadGateStatusByStage(product.id);
    expect(() => assertCanEnterReview(1, ctx, gates)).toThrow(/cannot enter review/i);
  });

  it("commits, versions, mirrors and audits an artifact in one call", async () => {
    const product = await createProductWithGates(workspace.id, "loop-commit");

    const result = await commitDecisionRegister(product, [COMPLETE_DECISION]);
    expect(result.versionNumber).toBe(1);
    expect(result.contentHash).toMatch(/^[0-9a-f]{64}$/);

    // The mirror file exists on disk and round-trips the persona (Non-Negotiable 7).
    const mirrorAbs = join(process.env.DPF_WORKSPACE_ROOT!, result.mirrorPath);
    const mirrored = await readFile(mirrorAbs, "utf8");
    expect(mirrored).toContain("Regional dispatch supervisor");

    // Exactly one immutable version, and an audit event recording it.
    const versions = await prisma.artifactVersion.findMany({
      where: { artifact: { productId: product.id } },
    });
    expect(versions).toHaveLength(1);
    const audit = await prisma.auditEvent.findMany({
      where: { productId: product.id, type: "ARTIFACT_VERSION_COMMITTED" },
    });
    expect(audit).toHaveLength(1);
  });

  it("closes the gate only when every required role has approved", async () => {
    const product = await createProductWithGates(workspace.id, "loop-approve");
    const commit = await commitDecisionRegister(product, [COMPLETE_DECISION]);
    // The live rows the exit criteria read.
    await prisma.decisionRecord.create({
      data: { productId: product.id, ...COMPLETE_DECISION },
    });

    // Exit criteria pass; the guard permits entering review.
    const ctx = await buildEvaluationContext(product.id);
    expect(evaluateStage(1, ctx).ready).toBe(true);
    const gate = await gateFor(product.id, 1);
    await prisma.$transaction((tx) =>
      setGateStatus(tx, {
        gateId: gate.id,
        to: "IN_REVIEW",
        actorId: owner.id,
        workspaceId: workspace.id,
        productId: product.id,
      }),
    );

    const approveAs = (actorId: string, actorRole: "CONSUMER_REP" | "PRODUCT_OWNER") =>
      prisma.$transaction((tx) =>
        approveGate(tx, {
          gateId: gate.id,
          actorId,
          actorRole,
          workspaceId: workspace.id,
          workspaceSlug: workspace.slug,
          productId: product.id,
          currentArtifactHash: commit.contentHash,
          artifactVersionId: commit.versionId,
        }),
      );

    // First approver: quorum not yet met, gate stays open.
    const first = await approveAs(consumer.id, "CONSUMER_REP");
    expect(first.gateClosed).toBe(false);
    expect(first.missingRoles).toContain("PRODUCT_OWNER");
    expect((await gateFor(product.id, 1)).status).toBe("IN_REVIEW");

    // Second approver completes quorum: the gate closes.
    const second = await approveAs(owner.id, "PRODUCT_OWNER");
    expect(second.gateClosed).toBe(true);
    expect((await gateFor(product.id, 1)).status).toBe("APPROVED");

    // Stage 2 is now unlocked.
    const gates = await loadGateStatusByStage(product.id);
    expect(isStageUnlocked(2, gates)).toEqual({ unlocked: true });
  });

  it("cascades APPROVED → STALE downstream when an approved upstream artifact changes", async () => {
    const product = await createProductWithGates(workspace.id, "loop-cascade");

    // --- Approve stage 1 through the real path. ---
    const reg = await commitDecisionRegister(product, [COMPLETE_DECISION]);
    await prisma.decisionRecord.create({
      data: { productId: product.id, ...COMPLETE_DECISION },
    });
    const gate1 = await gateFor(product.id, 1);
    await prisma.$transaction((tx) =>
      approveGate(tx, {
        gateId: gate1.id,
        actorId: consumer.id,
        actorRole: "CONSUMER_REP",
        workspaceId: workspace.id,
        workspaceSlug: workspace.slug,
        productId: product.id,
        currentArtifactHash: reg.contentHash,
        artifactVersionId: reg.versionId,
      }),
    );
    await prisma.$transaction((tx) =>
      approveGate(tx, {
        gateId: gate1.id,
        actorId: owner.id,
        actorRole: "PRODUCT_OWNER",
        workspaceId: workspace.id,
        workspaceSlug: workspace.slug,
        productId: product.id,
        currentArtifactHash: reg.contentHash,
        artifactVersionId: reg.versionId,
      }),
    );
    expect((await gateFor(product.id, 1)).status).toBe("APPROVED");

    // --- Approve stage 2 (the downstream gate) through the real path. ---
    const charterBody = CharterBody.parse({
      productName: "Cascade Demo",
      archetype: "CONSUMER_ALIGNED",
      tier: "GOLD",
      scopeBoundary: "In: dispatch. Out: billing.",
      valueHypothesis: "Unblocks the dispatch supervisor's crew-priority decision.",
      successMeasures: [{ measure: "Mean time to dispatch", target: "< 10 min" }],
    });
    const charter = await commitArtifact({
      workspaceId: workspace.id,
      workspaceSlug: workspace.slug,
      productId: product.id,
      productSlug: product.slug,
      stageNumber: 2,
      kind: "CHARTER",
      slug: "charter",
      format: "markdown",
      body: renderCharterMarkdown(charterBody),
      provenance: "HUMAN_AUTHORED",
      authorId: owner.id,
    });
    const gate2 = await gateFor(product.id, 2);
    for (const [actorId, actorRole] of [
      [owner.id, "PRODUCT_OWNER"],
      [architect.id, "DOMAIN_ARCHITECT"],
    ] as const) {
      await prisma.$transaction((tx) =>
        approveGate(tx, {
          gateId: gate2.id,
          actorId,
          actorRole,
          workspaceId: workspace.id,
          workspaceSlug: workspace.slug,
          productId: product.id,
          currentArtifactHash: charter.contentHash,
          artifactVersionId: charter.versionId,
        }),
      );
    }
    expect((await gateFor(product.id, 2)).status).toBe("APPROVED");

    // --- Edit the approved stage-1 artifact: stage 2 must go STALE. ---
    const edited = await commitDecisionRegister(product, [
      COMPLETE_DECISION,
      { ...COMPLETE_DECISION, persona: "Grid operations lead" },
    ]);
    expect(edited.contentHash).not.toBe(reg.contentHash);
    expect(edited.invalidatedStages).toContain(2);

    const staleGate = await gateFor(product.id, 2);
    expect(staleGate.status).toBe("STALE");
    expect(staleGate.stalenessReason).toMatch(/stage 1/i);

    const cascadeAudit = await prisma.auditEvent.findMany({
      where: { productId: product.id, type: "CASCADE_INVALIDATED" },
    });
    expect(cascadeAudit.length).toBeGreaterThan(0);
  });
});

describe("governance invariants under real writes", () => {
  it("re-committing identical content does not cascade", async () => {
    const product = await createProductWithGates(workspace.id, "loop-idempotent");
    const first = await commitDecisionRegister(product, [COMPLETE_DECISION]);
    const second = await commitDecisionRegister(product, [COMPLETE_DECISION]);
    expect(second.contentHash).toBe(first.contentHash);
    expect(second.versionNumber).toBe(2);
    expect(second.invalidatedStages).toEqual([]);
  });

  it("refuses a HUMAN_AUTHORED artifact with no author", async () => {
    const product = await createProductWithGates(workspace.id, "loop-provenance");
    await expect(
      commitArtifact({
        workspaceId: workspace.id,
        workspaceSlug: workspace.slug,
        productId: product.id,
        productSlug: product.slug,
        stageNumber: 1,
        kind: "DECISION_REGISTER",
        slug: "decision-register",
        format: "yaml",
        body: DecisionRegisterBody.parse({ decisions: [COMPLETE_DECISION] }),
        provenance: "HUMAN_AUTHORED",
        authorId: null,
      }),
    ).rejects.toThrow(/must name a human author/i);
  });

  it("persists an AI_DRAFT with a null author", async () => {
    const product = await createProductWithGates(workspace.id, "loop-ai-draft");
    const result = await commitArtifact({
      workspaceId: workspace.id,
      workspaceSlug: workspace.slug,
      productId: product.id,
      productSlug: product.slug,
      stageNumber: 1,
      kind: "DECISION_REGISTER",
      slug: "decision-register",
      format: "yaml",
      body: DecisionRegisterBody.parse({ decisions: [COMPLETE_DECISION] }),
      provenance: "AI_DRAFT",
      authorId: null,
    });
    const version = await prisma.artifactVersion.findUniqueOrThrow({
      where: { id: result.versionId },
    });
    expect(version.provenance).toBe("AI_DRAFT");
    expect(version.authorId).toBeNull();
  });

  it("rejects an approval from a user who does not hold the role", async () => {
    const product = await createProductWithGates(workspace.id, "loop-role");
    const reg = await commitDecisionRegister(product, [COMPLETE_DECISION]);
    const gate1 = await gateFor(product.id, 1);
    await expect(
      prisma.$transaction((tx) =>
        approveGate(tx, {
          gateId: gate1.id,
          // architect does not hold DATA_STEWARD.
          actorId: architect.id,
          actorRole: "DATA_STEWARD",
          workspaceId: workspace.id,
          workspaceSlug: workspace.slug,
          productId: product.id,
          currentArtifactHash: reg.contentHash,
          artifactVersionId: reg.versionId,
        }),
      ),
    ).rejects.toBeInstanceOf(GovernanceError);
    // Unrelated fact: hash helper stays consistent with what was committed.
    expect(await latestVersionHash(product.id, "decision-register")).toBe(reg.contentHash);
  });
});
