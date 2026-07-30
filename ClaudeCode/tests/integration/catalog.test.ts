import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/client";
import { commitArtifact } from "@/lib/artifacts/commit";
import { CharterBody, renderCharterMarkdown } from "@/lib/artifacts/schemas";
import { syncAttributes } from "@/lib/artifacts/attributes";
import { getWorkspaceCatalog } from "@/lib/queries";
import { createProductWithGates, createWorkspace } from "./factory";

/**
 * The control-plane catalog derives each card from committed state. This proves
 * the derivation against a real database: classification, counts, grain and the
 * charter value hypothesis all come out of what was actually committed, and a
 * bare product still yields a valid, empty card.
 */
let workspace: Awaited<ReturnType<typeof createWorkspace>>;

beforeAll(async () => {
  workspace = await createWorkspace("catalog-ws");
});

describe("getWorkspaceCatalog", () => {
  it("derives sensitivity, counts, grain and description from committed state", async () => {
    const product = await createProductWithGates(workspace.id, "catalog-rich");

    await prisma.$transaction((tx) =>
      syncAttributes(tx, product.id, [
        { name: "meter_id", dataType: "string", sensitivity: "INTERNAL", piiFlag: false, regulatoryFlags: "" },
        { name: "customer_ssn", dataType: "string", sensitivity: "RESTRICTED", piiFlag: true, regulatoryFlags: "" },
      ]),
    );

    await commitArtifact({
      workspaceId: workspace.id,
      workspaceSlug: workspace.slug,
      productId: product.id,
      productSlug: product.slug,
      stageNumber: 3,
      kind: "SOURCE_INVENTORY",
      slug: "source-inventory",
      format: "yaml",
      body: {
        sources: [
          { name: "Outage events", system: "SCADA", connectionKind: "DATABASE", description: "x", feasibility: "READY" },
          { name: "CIS", system: "CIS", connectionKind: "API", description: "y", feasibility: "GAPS" },
        ],
        gapLog: "",
      },
      provenance: "AI_DRAFT",
      authorId: null,
    });

    await commitArtifact({
      workspaceId: workspace.id,
      workspaceSlug: workspace.slug,
      productId: product.id,
      productSlug: product.slug,
      stageNumber: 4,
      kind: "LOGICAL_MODEL",
      slug: "logical-model",
      format: "yaml",
      body: {
        grainStatement: "One row per outage per service point.",
        entities: [{ name: "Outage", grain: "one per outage", description: "" }],
        conformedBindings: [],
        identityResolution: "SCADA event id.",
      },
      provenance: "AI_DRAFT",
      authorId: null,
    });

    await commitArtifact({
      workspaceId: workspace.id,
      workspaceSlug: workspace.slug,
      productId: product.id,
      productSlug: product.slug,
      stageNumber: 5,
      kind: "DATA_CONTRACT",
      slug: "data-contract",
      format: "yaml",
      body: {
        version: "1.0.0",
        fields: [
          { name: "outage_id", type: "string", required: true },
          { name: "started_at", type: "timestamp", required: true },
        ],
        sla: { freshness: "< 5 min" },
        qualityThresholds: [],
        deprecationPolicy: "90 days notice.",
      },
      provenance: "AI_DRAFT",
      authorId: null,
    });

    const charter = CharterBody.parse({
      productName: "Outage Response",
      archetype: "CONSUMER_ALIGNED",
      tier: "GOLD",
      scopeBoundary: "In: dispatch. Out: billing.",
      valueHypothesis: "Unblocks the dispatch supervisor's crew-priority decision during outages.",
      successMeasures: [{ measure: "MTTR", target: "< 10 min" }],
    });
    await commitArtifact({
      workspaceId: workspace.id,
      workspaceSlug: workspace.slug,
      productId: product.id,
      productSlug: product.slug,
      stageNumber: 2,
      kind: "CHARTER",
      slug: "charter",
      format: "markdown",
      body: renderCharterMarkdown(charter),
      provenance: "AI_DRAFT",
      authorId: null,
    });

    const catalog = await getWorkspaceCatalog(workspace.slug);
    const card = catalog!.cards.find((c) => c.slug === "catalog-rich")!;

    expect(card.sensitivity).toBe("RESTRICTED"); // highest wins
    expect(card.attributeCount).toBe(2);
    expect(card.sourceCount).toBe(2);
    expect(card.fieldCount).toBe(2);
    expect(card.grain).toContain("service point");
    expect(card.description).toContain("crew-priority decision");
  });

  it("yields a valid, empty card for a product with nothing authored", async () => {
    const product = await createProductWithGates(workspace.id, "catalog-bare");
    const catalog = await getWorkspaceCatalog(workspace.slug);
    const card = catalog!.cards.find((c) => c.slug === product.slug)!;

    expect(card.sensitivity).toBeNull();
    expect(card.attributeCount).toBe(0);
    expect(card.sourceCount).toBe(0);
    expect(card.fieldCount).toBe(0);
    expect(card.grain).toBeNull();
    expect(card.description).toBeNull();
    expect(card.code.length).toBeGreaterThanOrEqual(2);
  });

  it("returns null for an unknown workspace", async () => {
    expect(await getWorkspaceCatalog("does-not-exist")).toBeNull();
  });
});
