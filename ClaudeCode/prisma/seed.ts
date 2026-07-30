/**
 * `pnpm db:seed` — a workspace, one user per role, and a demo product parked at
 * stage 1 with an incomplete decision register.
 *
 * The demo product is deliberately NOT ready to advance: its single decision
 * record is missing a consequence, so stage 1's exit criteria fail and stage 2
 * stays locked. That is the first thing anyone should see working.
 *
 * Idempotent — safe to run repeatedly.
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";
import { STAGES } from "../src/lib/lifecycle/stages";
import { canonicalize, contentHash } from "../src/lib/artifacts/hash";
import type { Role } from "../src/lib/artifacts/enums";

const prisma = new PrismaClient();

const SEED_PASSWORD = "dpf-local-dev";

const PEOPLE: Array<{ email: string; name: string; roles: Role[] }> = [
  { email: "admin@dpf.local", name: "Ada Admin", roles: ["PLATFORM_ADMIN"] },
  { email: "owner@dpf.local", name: "Omar Owner", roles: ["PRODUCT_OWNER"] },
  { email: "architect@dpf.local", name: "Ana Architect", roles: ["DOMAIN_ARCHITECT"] },
  { email: "sme@dpf.local", name: "Sam SME", roles: ["DOMAIN_SME"] },
  { email: "engineer@dpf.local", name: "Eli Engineer", roles: ["PLATFORM_ENGINEER"] },
  { email: "steward@dpf.local", name: "Sol Steward", roles: ["DATA_STEWARD"] },
  { email: "privacy@dpf.local", name: "Priya Privacy", roles: ["PRIVACY_SECURITY_OFFICER"] },
  { email: "consumer@dpf.local", name: "Cam Consumer", roles: ["CONSUMER_REP"] },
];

async function main(): Promise<void> {
  const passwordHash = await hashPassword(SEED_PASSWORD);

  const workspace = await prisma.workspace.upsert({
    where: { slug: "demo" },
    create: { slug: "demo", name: "Demo Workspace", industryPack: "utility" },
    update: { industryPack: "utility" },
  });

  for (const person of PEOPLE) {
    const user = await prisma.user.upsert({
      where: { email: person.email },
      create: { email: person.email, name: person.name, passwordHash },
      update: { name: person.name },
    });

    for (const role of person.roles) {
      await prisma.roleAssignment.upsert({
        where: {
          userId_workspaceId_role: {
            userId: user.id,
            workspaceId: workspace.id,
            role,
          },
        },
        create: { userId: user.id, workspaceId: workspace.id, role },
        update: {},
      });
    }
  }

  const product = await prisma.product.upsert({
    where: { workspaceId_slug: { workspaceId: workspace.id, slug: "outage-response" } },
    create: {
      workspaceId: workspace.id,
      slug: "outage-response",
      name: "Outage Response",
    },
    update: {},
  });

  // Every product carries a gate row for every stage from the moment it exists,
  // so the lifecycle board never has to distinguish "missing" from "not started".
  for (const stage of STAGES) {
    await prisma.gate.upsert({
      where: {
        productId_stageNumber: { productId: product.id, stageNumber: stage.number },
      },
      create: {
        productId: product.id,
        stageNumber: stage.number,
        status: stage.number === 0 ? "APPROVED" : stage.number === 1 ? "DRAFT" : "NOT_STARTED",
      },
      update: {},
    });
  }

  // Stage 0's committed workspace.yaml, so the pre-approved gate has the setup
  // artifact behind it that the real creation flow produces. Author: the admin.
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@dpf.local" } });
  const setupBody = {
    workspaceSlug: workspace.slug,
    workspaceName: workspace.name,
    industryPack: workspace.industryPack,
    productSlug: product.slug,
    productName: product.name,
  };
  const existingSetup = await prisma.artifact.findUnique({
    where: {
      productId_kind_slug: { productId: product.id, kind: "WORKSPACE_SETUP", slug: "workspace" },
    },
  });
  if (!existingSetup) {
    const setupArtifact = await prisma.artifact.create({
      data: { productId: product.id, stageNumber: 0, kind: "WORKSPACE_SETUP", slug: "workspace" },
    });
    await prisma.artifactVersion.create({
      data: {
        artifactId: setupArtifact.id,
        versionNumber: 1,
        contentJson: canonicalize(setupBody),
        contentHash: contentHash(setupBody),
        provenance: "HUMAN_AUTHORED",
        authorId: admin.id,
      },
    });
  }

  const existingDecision = await prisma.decisionRecord.findFirst({
    where: { productId: product.id },
  });
  if (!existingDecision) {
    await prisma.decisionRecord.create({
      data: {
        productId: product.id,
        persona: "Regional dispatch supervisor",
        decision: "Which crew to send to which outage first, when several are open at once",
        cadence: "Every 15 minutes during an active event",
        // Deliberately blank: this is what keeps stage 2 locked on a fresh seed.
        consequence: "",
      },
    });
  }

  await prisma.auditEvent.create({
    data: {
      workspaceId: workspace.id,
      productId: product.id,
      type: "WORKSPACE_CREATED",
      payloadJson: JSON.stringify({ seeded: true, workspaceSlug: workspace.slug }),
    },
  });

  console.log(`Seeded workspace "${workspace.slug}" with ${PEOPLE.length} users.`);
  console.log(`Demo product: ${product.slug} (stage 1, decision register incomplete).`);
  console.log(`All seed users share the password: ${SEED_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
