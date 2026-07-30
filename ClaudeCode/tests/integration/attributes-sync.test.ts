import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/client";
import { syncAttributes } from "@/lib/artifacts/attributes";
import { buildEvaluationContext } from "@/lib/lifecycle/context";
import { requiresFullClassification } from "@/lib/lifecycle/exit-criteria";
import { createProductWithGates, createWorkspace } from "./factory";

/**
 * Non-Negotiable 10, end to end against a real database: committing an attribute
 * register projects rows into the Attribute table, and the Stage 9 classification
 * criterion reads exactly those rows — so an unclassified attribute keeps Stage 9
 * blocked, and classifying it unblocks the criterion.
 */
let workspace: Awaited<ReturnType<typeof createWorkspace>>;

beforeAll(async () => {
  workspace = await createWorkspace("attrs-ws");
});

async function classification(productId: string) {
  return requiresFullClassification(await buildEvaluationContext(productId));
}

describe("attribute register sync", () => {
  it("projects register attributes into the Attribute table", async () => {
    const product = await createProductWithGates(workspace.id, "attrs-project");
    await prisma.$transaction((tx) =>
      syncAttributes(tx, product.id, [
        { name: "meter_id", dataType: "string", sensitivity: "INTERNAL", piiFlag: false, regulatoryFlags: "" },
        { name: "customer_ssn", dataType: "string", sensitivity: null, piiFlag: true, regulatoryFlags: "GDPR" },
      ]),
    );

    const rows = await prisma.attribute.findMany({
      where: { productId: product.id, archivedAt: null },
      orderBy: { name: "asc" },
    });
    expect(rows.map((r) => r.name)).toEqual(["customer_ssn", "meter_id"]);
    expect(rows.find((r) => r.name === "customer_ssn")?.piiFlag).toBe(true);
  });

  it("keeps Stage 9 blocked while any attribute is unclassified, then unblocks it", async () => {
    const product = await createProductWithGates(workspace.id, "attrs-classify");

    await prisma.$transaction((tx) =>
      syncAttributes(tx, product.id, [
        { name: "meter_id", dataType: "string", sensitivity: "INTERNAL", piiFlag: false, regulatoryFlags: "" },
        { name: "customer_ssn", dataType: "string", sensitivity: null, piiFlag: true, regulatoryFlags: "" },
      ]),
    );
    const blocked = await classification(product.id);
    expect(blocked.passed).toBe(false);
    expect(blocked.detail).toContain("customer_ssn");

    // Re-commit the register with the attribute now classified.
    await prisma.$transaction((tx) =>
      syncAttributes(tx, product.id, [
        { name: "meter_id", dataType: "string", sensitivity: "INTERNAL", piiFlag: false, regulatoryFlags: "" },
        { name: "customer_ssn", dataType: "string", sensitivity: "RESTRICTED", piiFlag: true, regulatoryFlags: "" },
      ]),
    );
    const unblocked = await classification(product.id);
    expect(unblocked.passed).toBe(true);
  });

  it("archives an attribute the register no longer lists (no hard delete)", async () => {
    const product = await createProductWithGates(workspace.id, "attrs-archive");
    await prisma.$transaction((tx) =>
      syncAttributes(tx, product.id, [
        { name: "keep", dataType: "string", sensitivity: "PUBLIC", piiFlag: false, regulatoryFlags: "" },
        { name: "drop", dataType: "string", sensitivity: "PUBLIC", piiFlag: false, regulatoryFlags: "" },
      ]),
    );
    await prisma.$transaction((tx) =>
      syncAttributes(tx, product.id, [
        { name: "keep", dataType: "string", sensitivity: "PUBLIC", piiFlag: false, regulatoryFlags: "" },
      ]),
    );

    const active = await prisma.attribute.findMany({
      where: { productId: product.id, archivedAt: null },
    });
    expect(active.map((a) => a.name)).toEqual(["keep"]);
    // "drop" still exists, archived — never hard-deleted.
    const dropped = await prisma.attribute.findFirst({
      where: { productId: product.id, name: "drop" },
    });
    expect(dropped?.archivedAt).not.toBeNull();
  });
});
