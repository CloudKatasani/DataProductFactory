import { prisma } from "@/lib/db/client";
import type { ArtifactKind, GateStatus } from "@/lib/artifacts/enums";
import type { StageEvaluationContext } from "./types";

/**
 * Assembles the pure {@link StageEvaluationContext} an exit criterion needs from
 * committed database state. Exit criteria never touch the database themselves —
 * this is the one place that bridges persistence to those pure functions, so the
 * checklist UI, the transition guard and this builder all agree on one snapshot.
 *
 * Only the latest committed version of each artifact kind is surfaced; criteria
 * ask "does a committed X exist", not "how many revisions".
 */
export async function buildEvaluationContext(
  productId: string,
): Promise<StageEvaluationContext> {
  const product = await prisma.product.findUniqueOrThrow({
    where: { id: productId },
    select: { id: true, workspaceId: true },
  });

  const [decisionRecords, attributes, metrics, artifacts] = await Promise.all([
    prisma.decisionRecord.findMany({
      where: { productId, archivedAt: null },
      select: { persona: true, decision: true, cadence: true, consequence: true },
    }),
    prisma.attribute.findMany({
      where: { productId, archivedAt: null },
      select: { name: true, sensitivity: true },
    }),
    prisma.metric.findMany({
      where: { workspaceId: product.workspaceId, archivedAt: null },
      select: { name: true, definition: true, certified: true },
    }),
    prisma.artifact.findMany({
      where: { productId, archivedAt: null },
      select: {
        kind: true,
        slug: true,
        versions: {
          orderBy: { versionNumber: "desc" },
          take: 1,
          select: { versionNumber: true },
        },
      },
    }),
  ]);

  return {
    productId,
    decisionRecords,
    attributes,
    metrics,
    artifacts: artifacts
      .filter((a) => a.versions.length > 0)
      .map((a) => ({
        kind: a.kind as ArtifactKind,
        slug: a.slug,
        // Non-null: filtered to artifacts with at least one version above.
        versionNumber: a.versions[0]!.versionNumber,
      })),
  };
}

/**
 * The current gate status for every stage of a product, as the map the
 * transition engine's lock check consumes. Stages with no gate row are reported
 * NOT_STARTED so a caller never has to distinguish "missing" from "not started".
 */
export async function loadGateStatusByStage(
  productId: string,
): Promise<Map<number, GateStatus>> {
  const gates = await prisma.gate.findMany({
    where: { productId },
    select: { stageNumber: true, status: true },
  });
  return new Map(gates.map((g) => [g.stageNumber, g.status as GateStatus]));
}
