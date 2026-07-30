import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/client";
import { commitArtifact } from "@/lib/artifacts/commit";
import { parseArtifactBody } from "@/lib/artifacts/schemas";
import { autoApproveGate, setGateMode } from "@/lib/governance/gates";
import { GovernanceError } from "@/lib/governance/errors";
import { createProductWithGates, createUserWithRoles, createWorkspace, gateFor } from "./factory";

/**
 * Gate modes (the "manual gates and automated" request), proven against a real
 * database. The invariant under test is that automation never weakens
 * Non-Negotiable 2: an automated approval still runs through the single
 * approveGate choke point, is attributed to a human who holds every required
 * role, and is refused outright for veto gates.
 */

const DECISION = {
  persona: "Regional dispatch supervisor",
  decision: "Which crew to send first when several outages are open",
  cadence: "Every 15 minutes during an event",
  consequence: "Crews idle while customers stay dark",
};

let workspace: Awaited<ReturnType<typeof createWorkspace>>;
/** Holds BOTH stage-1 required roles, so may automate stage 1. */
let bothRoles: { id: string };
/** Holds only one stage-1 role. */
let ownerOnly: { id: string };

beforeAll(async () => {
  workspace = await createWorkspace("modes-ws");
  bothRoles = await createUserWithRoles(workspace.id, ["CONSUMER_REP", "PRODUCT_OWNER"]);
  ownerOnly = await createUserWithRoles(workspace.id, ["PRODUCT_OWNER"]);
});

async function commitRegister(product: { id: string; slug: string }) {
  const body = parseArtifactBody("DECISION_REGISTER", { decisions: [DECISION] });
  const commit = await commitArtifact({
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
    authorId: bothRoles.id,
  });
  await prisma.decisionRecord.create({ data: { productId: product.id, ...DECISION } });
  return commit;
}

function enable(gateId: string, actorId: string, productId: string) {
  return prisma.$transaction((tx) =>
    setGateMode(tx, {
      gateId,
      mode: "AUTOMATED",
      actorId,
      workspaceId: workspace.id,
      workspaceSlug: workspace.slug,
      productId,
    }),
  );
}

function runAuto(gateId: string, productId: string, hash: string, versionId: string) {
  return prisma.$transaction((tx) =>
    autoApproveGate(tx, {
      gateId,
      workspaceId: workspace.id,
      workspaceSlug: workspace.slug,
      productId,
      currentArtifactHash: hash,
      artifactVersionId: versionId,
    }),
  );
}

describe("gate modes", () => {
  it("auto-approves through approveGate when the enabler holds every role", async () => {
    const product = await createProductWithGates(workspace.id, "modes-auto");
    const commit = await commitRegister(product);
    const gate = await gateFor(product.id, 1);

    await enable(gate.id, bothRoles.id, product.id);
    expect((await gateFor(product.id, 1)).mode).toBe("AUTOMATED");

    const result = await runAuto(gate.id, product.id, commit.contentHash, commit.versionId);
    expect(result.attempted).toBe(true);
    expect(result.gateClosed).toBe(true);
    expect((await gateFor(product.id, 1)).status).toBe("APPROVED");

    // Both seats are filled by real Approval rows attributed to the enabling human.
    const approvals = await prisma.approval.findMany({ where: { gateId: gate.id } });
    expect(approvals.map((a) => a.role).sort()).toEqual(["CONSUMER_REP", "PRODUCT_OWNER"]);
    expect(approvals.every((a) => a.actorId === bothRoles.id)).toBe(true);
    expect(approvals.every((a) => a.decision === "APPROVE")).toBe(true);
  });

  it("records a GATE_MODE_CHANGED audit event when automation is enabled", async () => {
    const product = await createProductWithGates(workspace.id, "modes-audit");
    await commitRegister(product);
    const gate = await gateFor(product.id, 1);
    await enable(gate.id, bothRoles.id, product.id);

    const audit = await prisma.auditEvent.findMany({
      where: { productId: product.id, type: "GATE_MODE_CHANGED" },
    });
    expect(audit).toHaveLength(1);
  });

  it("refuses to automate a gate unless the actor holds every required role", async () => {
    const product = await createProductWithGates(workspace.id, "modes-partial");
    await commitRegister(product);
    const gate = await gateFor(product.id, 1);

    await expect(enable(gate.id, ownerOnly.id, product.id)).rejects.toBeInstanceOf(GovernanceError);
    // The gate stays MANUAL.
    expect((await gateFor(product.id, 1)).mode).toBe("MANUAL");
  });

  it("refuses to automate a veto gate no matter who asks", async () => {
    const product = await createProductWithGates(workspace.id, "modes-veto");
    // Someone holding BOTH stage-9 roles, including the veto role.
    const officer = await createUserWithRoles(workspace.id, [
      "PRIVACY_SECURITY_OFFICER",
      "DATA_STEWARD",
    ]);
    const gate9 = await gateFor(product.id, 9);

    await expect(
      prisma.$transaction((tx) =>
        setGateMode(tx, {
          gateId: gate9.id,
          mode: "AUTOMATED",
          actorId: officer.id,
          workspaceId: workspace.id,
          workspaceSlug: workspace.slug,
          productId: product.id,
        }),
      ),
    ).rejects.toThrow(/veto/i);
  });

  it("no-ops on a manual gate", async () => {
    const product = await createProductWithGates(workspace.id, "modes-manual");
    const commit = await commitRegister(product);
    const gate = await gateFor(product.id, 1);

    const result = await runAuto(gate.id, product.id, commit.contentHash, commit.versionId);
    expect(result.attempted).toBe(false);
    expect(result.gateClosed).toBe(false);
    expect((await gateFor(product.id, 1)).status).not.toBe("APPROVED");
  });

  it("no-ops (leaves the gate for a human) if the enabler later loses a required role", async () => {
    const product = await createProductWithGates(workspace.id, "modes-revoked");
    const commit = await commitRegister(product);
    const gate = await gateFor(product.id, 1);
    await enable(gate.id, bothRoles.id, product.id);

    // Revoke one of the enabler's required roles after automation was switched on.
    await prisma.roleAssignment.deleteMany({
      where: { userId: bothRoles.id, workspaceId: workspace.id, role: "CONSUMER_REP" },
    });

    const result = await runAuto(gate.id, product.id, commit.contentHash, commit.versionId);
    expect(result.attempted).toBe(false);
    expect((await gateFor(product.id, 1)).status).not.toBe("APPROVED");
    expect(await prisma.approval.count({ where: { gateId: gate.id } })).toBe(0);

    // Restore for any later test relying on this shared user.
    await prisma.roleAssignment.create({
      data: { userId: bothRoles.id, workspaceId: workspace.id, role: "CONSUMER_REP" },
    });
  });
});
