import { prisma } from "@/lib/db/client";
import { listPackIds, loadAllPacks } from "@/lib/packs/loader";
import type { ArtifactKind, GateMode, GateStatus, Provenance, Role } from "@/lib/artifacts/enums";
import { STAGES, stageAllowsAutomation } from "@/lib/lifecycle/stages";
import { buildEvaluationContext, loadGateStatusByStage } from "@/lib/lifecycle/context";
import { evaluateStage, isStageUnlocked } from "@/lib/lifecycle/transition";
import type { CriterionResult } from "@/lib/lifecycle/types";

/**
 * Read models for the UI. Everything a page renders is assembled here from
 * committed state, so pages stay declarative and the same lock/criteria logic
 * the transition engine enforces is what the screen shows.
 */

export interface StageView {
  number: number;
  title: string;
  requiredApprovers: Role[];
  status: GateStatus;
  gateId: string | null;
  mode: GateMode;
  /** False for veto gates, which can never be automated. */
  automatable: boolean;
  /** Name of the human who enabled automation, when mode is AUTOMATED. */
  automationByName: string | null;
  unlocked: boolean;
  blockingStage: number | null;
  ready: boolean;
  criteria: CriterionResult[];
  artifacts: Array<{
    versionId: string;
    kind: ArtifactKind;
    slug: string;
    versionNumber: number;
    provenance: Provenance;
  }>;
}

export interface ProductView {
  workspace: { id: string; slug: string; name: string };
  product: { id: string; slug: string; name: string; archetype: string | null; tier: string | null };
  stages: StageView[];
  decisionRecords: Array<{
    id: string;
    persona: string;
    decision: string;
    cadence: string;
    consequence: string;
    complete: boolean;
  }>;
}

/**
 * Packs available to seed a new workspace, resilient to a single broken pack: if
 * full validation fails, fall back to the directory names so the picker still
 * works and the create action re-validates the chosen one.
 */
export async function listAvailablePacks(): Promise<Array<{ id: string; name: string }>> {
  try {
    return (await loadAllPacks()).map((p) => ({ id: p.id, name: p.name }));
  } catch {
    return (await listPackIds()).map((id) => ({ id, name: id }));
  }
}

export async function listWorkspaces() {
  return prisma.workspace.findMany({
    where: { archivedAt: null },
    orderBy: { name: "asc" },
    select: {
      id: true,
      slug: true,
      name: true,
      industryPack: true,
      _count: { select: { products: true } },
    },
  });
}

export async function getWorkspaceView(slug: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { slug },
    include: {
      products: {
        where: { archivedAt: null },
        orderBy: { name: "asc" },
        include: { gates: { select: { stageNumber: true, status: true } } },
      },
    },
  });
  if (!workspace || workspace.archivedAt) return null;

  const products = workspace.products.map((p) => {
    const approved = p.gates.filter((g) => g.status === "APPROVED").length;
    // Current stage = the first stage whose gate is not yet approved.
    const current = p.gates
      .slice()
      .sort((a, b) => a.stageNumber - b.stageNumber)
      .find((g) => g.status !== "APPROVED");
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      approvedStages: approved,
      currentStage: current?.stageNumber ?? STAGES.length - 1,
    };
  });

  return {
    workspace: {
      id: workspace.id,
      slug: workspace.slug,
      name: workspace.name,
      industryPack: workspace.industryPack,
    },
    products,
  };
}

export async function getProductView(
  workspaceSlug: string,
  productSlug: string,
): Promise<ProductView | null> {
  const workspace = await prisma.workspace.findUnique({ where: { slug: workspaceSlug } });
  if (!workspace || workspace.archivedAt) return null;

  const product = await prisma.product.findUnique({
    where: { workspaceId_slug: { workspaceId: workspace.id, slug: productSlug } },
  });
  if (!product || product.archivedAt) return null;

  const [ctx, gateStatusByStage, gateRows, artifacts, decisionRecords] = await Promise.all([
    buildEvaluationContext(product.id),
    loadGateStatusByStage(product.id),
    prisma.gate.findMany({
      where: { productId: product.id },
      select: {
        id: true,
        stageNumber: true,
        status: true,
        mode: true,
        automationById: true,
      },
    }),
    prisma.artifact.findMany({
      where: { productId: product.id, archivedAt: null },
      select: {
        kind: true,
        slug: true,
        stageNumber: true,
        versions: {
          orderBy: { versionNumber: "desc" },
          take: 1,
          select: { id: true, versionNumber: true, provenance: true },
        },
      },
    }),
    prisma.decisionRecord.findMany({
      where: { productId: product.id, archivedAt: null },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const gateByStage = new Map(gateRows.map((g) => [g.stageNumber, g]));

  // Resolve the names of the humans who enabled automation, in one lookup.
  const enablerIds = [...new Set(gateRows.map((g) => g.automationById).filter((id): id is string => !!id))];
  const enablers = enablerIds.length
    ? await prisma.user.findMany({ where: { id: { in: enablerIds } }, select: { id: true, name: true } })
    : [];
  const enablerName = new Map(enablers.map((u) => [u.id, u.name]));

  const stages: StageView[] = STAGES.map((stage) => {
    const gate = gateByStage.get(stage.number);
    const status = (gate?.status as GateStatus) ?? "NOT_STARTED";
    const mode = (gate?.mode as GateMode) ?? "MANUAL";
    const lock = isStageUnlocked(stage.number, gateStatusByStage);
    const readiness = evaluateStage(stage.number, ctx);
    return {
      number: stage.number,
      title: stage.title,
      requiredApprovers: [...stage.requiredApprovers],
      status,
      gateId: gate?.id ?? null,
      mode,
      automatable: stageAllowsAutomation(stage.number),
      automationByName:
        mode === "AUTOMATED" && gate?.automationById
          ? (enablerName.get(gate.automationById) ?? null)
          : null,
      unlocked: lock.unlocked,
      blockingStage: lock.unlocked ? null : lock.blockingStage,
      ready: readiness.ready,
      criteria: readiness.criteria,
      artifacts: artifacts
        .filter((a) => a.stageNumber === stage.number && a.versions.length > 0)
        .map((a) => ({
          versionId: a.versions[0]!.id,
          kind: a.kind as ArtifactKind,
          slug: a.slug,
          versionNumber: a.versions[0]!.versionNumber,
          provenance: a.versions[0]!.provenance as Provenance,
        })),
    };
  });

  return {
    workspace: { id: workspace.id, slug: workspace.slug, name: workspace.name },
    product: {
      id: product.id,
      slug: product.slug,
      name: product.name,
      archetype: product.archetype,
      tier: product.tier,
    },
    stages,
    decisionRecords: decisionRecords.map((d) => ({
      id: d.id,
      persona: d.persona,
      decision: d.decision,
      cadence: d.cadence,
      consequence: d.consequence,
      complete:
        d.persona.trim() !== "" &&
        d.decision.trim() !== "" &&
        d.cadence.trim() !== "" &&
        d.consequence.trim() !== "",
    })),
  };
}

export interface ReviewItem {
  gateId: string;
  workspaceSlug: string;
  productSlug: string;
  productName: string;
  stageNumber: number;
  stageTitle: string;
  status: GateStatus;
  requiredApprovers: Role[];
}

/** Gates currently awaiting a reviewer decision, newest activity first. */
export async function getReviewItems(): Promise<ReviewItem[]> {
  const gates = await prisma.gate.findMany({
    where: { status: { in: ["IN_REVIEW", "CHANGES_REQUESTED", "STALE"] } },
    orderBy: { updatedAt: "desc" },
    include: { product: { include: { workspace: true } } },
  });

  const titleByStage = new Map(STAGES.map((s) => [s.number, s]));
  return gates.map((g) => {
    const stage = titleByStage.get(g.stageNumber);
    return {
      gateId: g.id,
      workspaceSlug: g.product.workspace.slug,
      productSlug: g.product.slug,
      productName: g.product.name,
      stageNumber: g.stageNumber,
      stageTitle: stage?.title ?? `Stage ${g.stageNumber}`,
      status: g.status as GateStatus,
      requiredApprovers: stage ? [...stage.requiredApprovers] : [],
    };
  });
}
