import type { Prisma } from "@prisma/client";
import { LAST_STAGE } from "@/lib/lifecycle/stages";
import { setGateStatus } from "./gates";

/**
 * Non-negotiable 5. Editing an approved upstream artifact invalidates downstream
 * gate approvals and surfaces a re-approval task.
 *
 * Downstream is defined by stage number: everything strictly after the edited
 * stage. A finer dependency graph would be more precise, but stage order is the
 * dependency order the lifecycle already guarantees, and an over-broad
 * invalidation is the safe direction to be wrong in — silent drift between an
 * approved contract and its dependents is the failure mode this app exists to
 * prevent.
 */
export interface CascadeInput {
  productId: string;
  workspaceId: string;
  actorId: string;
  /** Stage whose approved artifact was just edited. */
  editedStageNumber: number;
  /** Artifact that changed, for the re-approval task's explanation. */
  artifactKind: string;
}

export interface CascadeResult {
  /** Stage numbers whose gates moved APPROVED → STALE. */
  invalidatedStages: number[];
}

export async function cascadeInvalidate(
  tx: Prisma.TransactionClient,
  input: CascadeInput,
): Promise<CascadeResult> {
  const downstream = await tx.gate.findMany({
    where: {
      productId: input.productId,
      status: "APPROVED",
      stageNumber: { gt: input.editedStageNumber, lte: LAST_STAGE },
    },
    orderBy: { stageNumber: "asc" },
  });

  const reason = `Stage ${input.editedStageNumber} ${input.artifactKind} changed after this gate was approved.`;

  for (const gate of downstream) {
    await setGateStatus(tx, {
      gateId: gate.id,
      to: "STALE",
      actorId: input.actorId,
      workspaceId: input.workspaceId,
      productId: input.productId,
      reason,
    });
  }

  if (downstream.length > 0) {
    await tx.auditEvent.create({
      data: {
        workspaceId: input.workspaceId,
        productId: input.productId,
        actorId: input.actorId,
        type: "CASCADE_INVALIDATED",
        payloadJson: JSON.stringify({
          editedStageNumber: input.editedStageNumber,
          artifactKind: input.artifactKind,
          invalidatedStages: downstream.map((g) => g.stageNumber),
        }),
      },
    });
  }

  return { invalidatedStages: downstream.map((g) => g.stageNumber) };
}
