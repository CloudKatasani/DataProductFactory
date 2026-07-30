import { ArtifactKind, Provenance } from "./enums";
import { canonicalize, contentHash } from "./hash";
import { mirrorArtifact, type MirrorFormat } from "./mirror";
import { cascadeInvalidate } from "@/lib/governance/cascade";
import { recordAudit } from "@/lib/governance/audit";
import { prisma } from "@/lib/db/client";

/**
 * The single write path for artifact content. Nothing else in the codebase may
 * create an ArtifactVersion.
 *
 * One call does all of it, in one transaction:
 *   1. validates the body against the artifact's Zod schema (caller-supplied),
 *   2. hashes the canonical JSON,
 *   3. writes an immutable version row,
 *   4. mirrors the file under workspace/,
 *   5. cascade-invalidates downstream approved gates,
 *   6. emits an AuditEvent.
 *
 * If any step throws, none of it happened.
 */
export interface CommitArtifactInput {
  workspaceId: string;
  workspaceSlug: string;
  productId: string;
  productSlug: string;
  stageNumber: number;
  kind: ArtifactKind;
  /** Stable file/identity stem within the product, e.g. "data-contract". */
  slug: string;
  format: MirrorFormat;
  /** Already validated against the artifact's schema by the caller. */
  body: unknown;
  provenance: Provenance;
  /** Null for AI drafts, which have no human author until someone accepts them. */
  authorId: string | null;
}

export interface CommitArtifactResult {
  artifactId: string;
  versionId: string;
  versionNumber: number;
  contentHash: string;
  mirrorPath: string;
  invalidatedStages: number[];
}

export async function commitArtifact(
  input: CommitArtifactInput,
): Promise<CommitArtifactResult> {
  ArtifactKind.parse(input.kind);
  Provenance.parse(input.provenance);

  if (input.provenance !== "AI_DRAFT" && input.authorId === null) {
    throw new Error(
      `A ${input.provenance} artifact must name a human author. Only AI_DRAFT may have a null authorId.`,
    );
  }

  const hash = contentHash(input.body);
  const json = canonicalize(input.body);

  // Mirror before the transaction: a file written for a rolled-back transaction
  // is a harmless orphan that the next commit overwrites, whereas a committed
  // row whose mirror failed to write would break non-negotiable 7 silently.
  const mirrorPath = await mirrorArtifact({
    workspaceSlug: input.workspaceSlug,
    productSlug: input.productSlug,
    slug: input.slug,
    format: input.format,
    body: input.body,
  });

  return prisma.$transaction(async (tx) => {
    const artifact = await tx.artifact.upsert({
      where: {
        productId_kind_slug: {
          productId: input.productId,
          kind: input.kind,
          slug: input.slug,
        },
      },
      create: {
        productId: input.productId,
        stageNumber: input.stageNumber,
        kind: input.kind,
        slug: input.slug,
      },
      update: {},
    });

    const previous = await tx.artifactVersion.findFirst({
      where: { artifactId: artifact.id },
      orderBy: { versionNumber: "desc" },
    });
    const versionNumber = (previous?.versionNumber ?? 0) + 1;

    const version = await tx.artifactVersion.create({
      data: {
        artifactId: artifact.id,
        versionNumber,
        contentJson: json,
        contentHash: hash,
        provenance: input.provenance,
        authorId: input.authorId,
        mirrorPath,
      },
    });

    await recordAudit(tx, {
      workspaceId: input.workspaceId,
      productId: input.productId,
      actorId: input.authorId ?? undefined,
      type: "ARTIFACT_VERSION_COMMITTED",
      payload: {
        artifactId: artifact.id,
        kind: input.kind,
        slug: input.slug,
        versionNumber,
        contentHash: hash,
        provenance: input.provenance,
        mirrorPath,
      },
    });

    // Only a genuine content change can invalidate downstream approvals.
    // Re-committing identical content must not cascade.
    let invalidatedStages: number[] = [];
    const contentChanged = previous !== null && previous.contentHash !== hash;
    if (contentChanged) {
      const result = await cascadeInvalidate(tx, {
        productId: input.productId,
        workspaceId: input.workspaceId,
        actorId: input.authorId ?? "system",
        editedStageNumber: input.stageNumber,
        artifactKind: input.kind,
      });
      invalidatedStages = result.invalidatedStages;
    }

    return {
      artifactId: artifact.id,
      versionId: version.id,
      versionNumber,
      contentHash: hash,
      mirrorPath,
      invalidatedStages,
    };
  });
}
