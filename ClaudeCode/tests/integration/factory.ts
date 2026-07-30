import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/client";
import { hashPassword } from "@/lib/auth/password";
import { STAGES } from "@/lib/lifecycle/stages";
import type { Role } from "@/lib/artifacts/enums";

/**
 * Minimal test-data builders over the real Prisma client (pointed at the
 * throwaway test.db). Slugs are caller-supplied and expected to be unique per
 * test so parallel test files never collide.
 */

export async function createWorkspace(slug: string) {
  return prisma.workspace.create({
    data: { slug, name: `Workspace ${slug}`, industryPack: "_generic" },
  });
}

/** Creates a user holding exactly the given roles in the workspace. */
export async function createUserWithRoles(
  workspaceId: string,
  roles: Role[],
): Promise<{ id: string; email: string }> {
  const passwordHash = await hashPassword("test-password");
  // A UUID keeps emails unique across isolated test workers, which each reset
  // any module-level counter to zero.
  const email = `user-${randomUUID()}-${roles.join("-").toLowerCase()}@test.local`;
  const user = await prisma.user.create({
    data: { email, name: email, passwordHash },
  });
  for (const role of roles) {
    await prisma.roleAssignment.create({
      data: { userId: user.id, workspaceId, role },
    });
  }
  return { id: user.id, email };
}

/**
 * A product with a gate row for every stage, mirroring what product creation
 * does in the app: stage 0 pre-approved, stage 1 in DRAFT, the rest NOT_STARTED.
 */
export async function createProductWithGates(workspaceId: string, slug: string) {
  const product = await prisma.product.create({
    data: { workspaceId, slug, name: `Product ${slug}` },
  });
  for (const stage of STAGES) {
    await prisma.gate.create({
      data: {
        productId: product.id,
        stageNumber: stage.number,
        status:
          stage.number === 0 ? "APPROVED" : stage.number === 1 ? "DRAFT" : "NOT_STARTED",
      },
    });
  }
  return product;
}

export async function gateFor(productId: string, stageNumber: number) {
  return prisma.gate.findUniqueOrThrow({
    where: { productId_stageNumber: { productId, stageNumber } },
  });
}

export async function latestVersionHash(
  productId: string,
  slug: string,
): Promise<string> {
  const version = await prisma.artifactVersion.findFirstOrThrow({
    where: { artifact: { productId, slug } },
    orderBy: { versionNumber: "desc" },
  });
  return version.contentHash;
}
