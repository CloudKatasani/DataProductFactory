"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { prisma } from "@/lib/db/client";
import { Role } from "@/lib/artifacts/enums";
import { commitArtifact } from "@/lib/artifacts/commit";
import { CharterBody, parseArtifactBody, renderCharterMarkdown } from "@/lib/artifacts/schemas";
import { approveGate, recordReviewDecision, setGateStatus } from "@/lib/governance/gates";
import { GovernanceError } from "@/lib/governance/errors";
import { buildEvaluationContext, loadGateStatusByStage } from "@/lib/lifecycle/context";
import { assertCanEnterReview } from "@/lib/lifecycle/transition";
import { STAGES } from "@/lib/lifecycle/stages";
import { requireRole, requireUser, rolesInWorkspace } from "@/lib/auth/session";

/**
 * Server actions: the only mutation surface the UI has. Each one authenticates
 * the actor and resolves their roles from the database — never from the client —
 * and returns a typed result so governance failures render as guidance rather
 * than crashing a page (CLAUDE.md: errors are typed and surfaced).
 */
export type ActionResult = { ok: true } | { ok: false; error: string };

function fail(error: unknown): ActionResult {
  if (error instanceof GovernanceError) return { ok: false, error: error.message };
  if (error instanceof ZodError) {
    return { ok: false, error: error.issues.map((i) => i.message).join("; ") };
  }
  if (error instanceof Error) return { ok: false, error: error.message };
  return { ok: false, error: "Something went wrong." };
}

interface ProductContext {
  productId: string;
  workspaceId: string;
  workspaceSlug: string;
  productSlug: string;
}

async function loadProductContext(productId: string): Promise<ProductContext> {
  const product = await prisma.product.findUniqueOrThrow({
    where: { id: productId },
    include: { workspace: true },
  });
  return {
    productId: product.id,
    workspaceId: product.workspaceId,
    workspaceSlug: product.workspace.slug,
    productSlug: product.slug,
  };
}

/** A member is anyone holding at least one role in the workspace. */
async function requireMembership(productId: string) {
  const user = await requireUser();
  const ctx = await loadProductContext(productId);
  const roles = await rolesInWorkspace(user.id, ctx.workspaceId);
  if (roles.length === 0) {
    throw new GovernanceError(
      "You are not a member of this workspace, so you cannot author its artifacts.",
      "NOT_AUTHORIZED",
    );
  }
  return { user, ctx, roles };
}

function productPath(ctx: ProductContext): string {
  return `/workspace/${ctx.workspaceSlug}/product/${ctx.productSlug}`;
}

export type CreateProductResult =
  | { ok: true; productSlug: string }
  | { ok: false; error: string };

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Create a product inside a workspace. Platform-Admin-only: this is the Stage 0
 * setup act. It creates the product and its full gate row set, commits the
 * workspace.yaml (WORKSPACE_SETUP) artifact, and opens Stage 0 for review — so
 * the admin then approves Stage 0 through the ordinary gate, which unlocks
 * Stage 1. Nothing here writes APPROVED; the approval stays a recorded human
 * action through approveGate.
 */
export async function createProductAction(
  workspaceSlug: string,
  input: { name: string; slug?: string },
): Promise<CreateProductResult> {
  try {
    const user = await requireUser();
    const workspace = await prisma.workspace.findUnique({ where: { slug: workspaceSlug } });
    if (!workspace || workspace.archivedAt) {
      return { ok: false, error: "That workspace no longer exists." };
    }
    // Product creation is the Stage 0 setup act, reserved for the Platform Admin.
    await requireRole(user.id, workspace.id, workspace.slug, "PLATFORM_ADMIN");

    const name = input.name.trim();
    if (!name) return { ok: false, error: "A product needs a name." };
    const slug = slugify(input.slug?.trim() || name);
    if (!slug) {
      return { ok: false, error: "Could not derive a URL slug from that name." };
    }

    const existing = await prisma.product.findUnique({
      where: { workspaceId_slug: { workspaceId: workspace.id, slug } },
    });
    if (existing) {
      return { ok: false, error: `A product with the slug "${slug}" already exists here.` };
    }

    const product = await prisma.product.create({
      data: {
        workspaceId: workspace.id,
        slug,
        name,
        gates: {
          create: STAGES.map((stage) => ({
            stageNumber: stage.number,
            // Stage 0 opens for setup; Stage 1 is authorable once Stage 0 closes.
            status: stage.number <= 1 ? "DRAFT" : "NOT_STARTED",
          })),
        },
      },
    });

    await prisma.auditEvent.create({
      data: {
        workspaceId: workspace.id,
        productId: product.id,
        actorId: user.id,
        type: "PRODUCT_CREATED",
        payloadJson: JSON.stringify({ productSlug: slug, productName: name }),
      },
    });

    const body = parseArtifactBody("WORKSPACE_SETUP", {
      workspaceSlug: workspace.slug,
      workspaceName: workspace.name,
      industryPack: workspace.industryPack,
      productSlug: slug,
      productName: name,
    });
    await commitArtifact({
      workspaceId: workspace.id,
      workspaceSlug: workspace.slug,
      productId: product.id,
      productSlug: slug,
      stageNumber: 0,
      kind: "WORKSPACE_SETUP",
      slug: "workspace",
      format: "yaml",
      body,
      provenance: "HUMAN_AUTHORED",
      authorId: user.id,
    });

    // Open Stage 0 for the Platform Admin's approval.
    const gate0 = await prisma.gate.findUniqueOrThrow({
      where: { productId_stageNumber: { productId: product.id, stageNumber: 0 } },
    });
    await prisma.$transaction((tx) =>
      setGateStatus(tx, {
        gateId: gate0.id,
        to: "IN_REVIEW",
        actorId: user.id,
        workspaceId: workspace.id,
        productId: product.id,
      }),
    );

    revalidatePath(`/workspace/${workspace.slug}`);
    return { ok: true, productSlug: slug };
  } catch (error) {
    const r = fail(error);
    return { ok: false, error: r.ok ? "" : r.error };
  }
}

export async function addDecisionRecordAction(
  productId: string,
  fields: { persona: string; decision: string; cadence: string; consequence: string },
): Promise<ActionResult> {
  try {
    const { ctx } = await requireMembership(productId);
    await prisma.decisionRecord.create({
      data: {
        productId,
        persona: fields.persona.trim(),
        decision: fields.decision.trim(),
        cadence: fields.cadence.trim(),
        consequence: fields.consequence.trim(),
      },
    });
    revalidatePath(`${productPath(ctx)}/stage/1`);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function archiveDecisionRecordAction(
  recordId: string,
): Promise<ActionResult> {
  try {
    const record = await prisma.decisionRecord.findUniqueOrThrow({ where: { id: recordId } });
    const { ctx } = await requireMembership(record.productId);
    // No hard deletes anywhere in the domain (Non-Negotiable 4) — archive it.
    await prisma.decisionRecord.update({
      where: { id: recordId },
      data: { archivedAt: new Date() },
    });
    revalidatePath(`${productPath(ctx)}/stage/1`);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Package the product's complete decision records into a committed, versioned,
 * mirrored DECISION_REGISTER. Human-authored: the acting user is the author.
 */
export async function commitDecisionRegisterAction(
  productId: string,
): Promise<ActionResult> {
  try {
    const { user, ctx } = await requireMembership(productId);

    const records = await prisma.decisionRecord.findMany({
      where: { productId, archivedAt: null },
      orderBy: { createdAt: "asc" },
    });
    const decisions = records
      .filter(
        (d) =>
          d.persona.trim() && d.decision.trim() && d.cadence.trim() && d.consequence.trim(),
      )
      .map((d) => ({
        persona: d.persona,
        decision: d.decision,
        cadence: d.cadence,
        consequence: d.consequence,
      }));

    const body = parseArtifactBody("DECISION_REGISTER", { decisions });

    await commitArtifact({
      workspaceId: ctx.workspaceId,
      workspaceSlug: ctx.workspaceSlug,
      productId: ctx.productId,
      productSlug: ctx.productSlug,
      stageNumber: 1,
      kind: "DECISION_REGISTER",
      slug: "decision-register",
      format: "yaml",
      body,
      provenance: "HUMAN_AUTHORED",
      authorId: user.id,
    });

    revalidatePath(`${productPath(ctx)}/stage/1`);
    revalidatePath(productPath(ctx));
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Stage 2. Validate the charter's structured shape, render it to Markdown, and
 * commit it as the CHARTER artifact (Non-Negotiable 7 mirrors the .md). The
 * product's archetype and tier are set from the charter — they are null until a
 * charter exists, by design.
 */
export async function commitCharterAction(
  productId: string,
  input: {
    productName: string;
    archetype: string;
    tier: string;
    scopeBoundary: string;
    valueHypothesis: string;
    successMeasures: Array<{ measure: string; target: string }>;
  },
): Promise<ActionResult> {
  try {
    const { user, ctx } = await requireMembership(productId);
    const body = CharterBody.parse(input);

    await commitArtifact({
      workspaceId: ctx.workspaceId,
      workspaceSlug: ctx.workspaceSlug,
      productId: ctx.productId,
      productSlug: ctx.productSlug,
      stageNumber: 2,
      kind: "CHARTER",
      slug: "charter",
      format: "markdown",
      body: renderCharterMarkdown(body),
      provenance: "HUMAN_AUTHORED",
      authorId: user.id,
    });

    await prisma.product.update({
      where: { id: productId },
      data: { archetype: body.archetype, tier: body.tier },
    });

    revalidatePath(`${productPath(ctx)}/stage/2`);
    revalidatePath(productPath(ctx));
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function enterReviewAction(
  productId: string,
  stageNumber: number,
): Promise<ActionResult> {
  try {
    const { user, ctx } = await requireMembership(productId);
    const [evalCtx, gateStatusByStage] = await Promise.all([
      buildEvaluationContext(productId),
      loadGateStatusByStage(productId),
    ]);

    // Throws a typed STAGE_LOCKED or EXIT_CRITERIA_UNMET error the UI surfaces.
    assertCanEnterReview(stageNumber, evalCtx, gateStatusByStage);

    const gate = await prisma.gate.findUniqueOrThrow({
      where: { productId_stageNumber: { productId, stageNumber } },
    });
    await prisma.$transaction((tx) =>
      setGateStatus(tx, {
        gateId: gate.id,
        to: "IN_REVIEW",
        actorId: user.id,
        workspaceId: ctx.workspaceId,
        productId,
      }),
    );

    revalidatePath(`${productPath(ctx)}/stage/${stageNumber}`);
    revalidatePath(productPath(ctx));
    revalidatePath("/review");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/** Latest committed version among a stage's artifacts — what an approval binds to. */
async function stagePrimaryVersion(productId: string, stageNumber: number) {
  const version = await prisma.artifactVersion.findFirst({
    where: { artifact: { productId, stageNumber, archivedAt: null } },
    orderBy: { versionNumber: "desc" },
  });
  return version;
}

export async function approveGateAction(
  gateId: string,
  actorRole: string,
  comment?: string,
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const role = Role.parse(actorRole);
    const gate = await prisma.gate.findUniqueOrThrow({ where: { id: gateId } });
    const ctx = await loadProductContext(gate.productId);

    const version = await stagePrimaryVersion(gate.productId, gate.stageNumber);
    if (!version) {
      return {
        ok: false,
        error: "There is no committed artifact to approve for this stage yet.",
      };
    }

    await prisma.$transaction((tx) =>
      approveGate(tx, {
        gateId,
        actorId: user.id,
        actorRole: role,
        workspaceId: ctx.workspaceId,
        workspaceSlug: ctx.workspaceSlug,
        productId: gate.productId,
        currentArtifactHash: version.contentHash,
        artifactVersionId: version.id,
        comment,
      }),
    );

    revalidatePath(`${productPath(ctx)}/stage/${gate.stageNumber}`);
    revalidatePath(productPath(ctx));
    revalidatePath("/review");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function reviewDecisionAction(
  gateId: string,
  actorRole: string,
  decision: "REJECT" | "REQUEST_CHANGES",
  comment?: string,
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const role = Role.parse(actorRole);
    const gate = await prisma.gate.findUniqueOrThrow({ where: { id: gateId } });
    const ctx = await loadProductContext(gate.productId);

    const version = await stagePrimaryVersion(gate.productId, gate.stageNumber);
    if (!version) {
      return { ok: false, error: "There is no committed artifact to review for this stage yet." };
    }

    await prisma.$transaction((tx) =>
      recordReviewDecision(tx, {
        gateId,
        actorId: user.id,
        actorRole: role,
        workspaceId: ctx.workspaceId,
        workspaceSlug: ctx.workspaceSlug,
        productId: gate.productId,
        decision,
        currentArtifactHash: version.contentHash,
        artifactVersionId: version.id,
        comment,
      }),
    );

    revalidatePath(`${productPath(ctx)}/stage/${gate.stageNumber}`);
    revalidatePath(productPath(ctx));
    revalidatePath("/review");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
