import { describe, expect, it } from "vitest";
import {
  DecisionRegisterBody,
  CharterBody,
  SourceInventoryBody,
  renderCharterMarkdown,
  getArtifactSchema,
  hasArtifactSchema,
  parseArtifactBody,
  UnknownArtifactSchemaError,
} from "@/lib/artifacts/schemas";

describe("DECISION_REGISTER body schema", () => {
  const complete = {
    persona: "Regional dispatch supervisor",
    decision: "Which crew to send first when several outages are open",
    cadence: "Every 15 minutes during an event",
    consequence: "Crews idle while customers stay dark",
  };

  it("requires at least one decision", () => {
    expect(DecisionRegisterBody.safeParse({ decisions: [] }).success).toBe(false);
  });

  it("rejects a decision missing its consequence", () => {
    const result = DecisionRegisterBody.safeParse({
      decisions: [{ ...complete, consequence: "" }],
    });
    expect(result.success).toBe(false);
  });

  it("treats whitespace-only fields as empty", () => {
    const result = DecisionRegisterBody.safeParse({
      decisions: [{ ...complete, persona: "   " }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts one complete decision and defaults the collections", () => {
    const parsed = DecisionRegisterBody.parse({ decisions: [complete] });
    expect(parsed.decisions).toHaveLength(1);
    expect(parsed.personas).toEqual([]);
    expect(parsed.questions).toEqual([]);
    expect(parsed.currentStatePain).toBe("");
  });
});

describe("CHARTER body schema", () => {
  const charter = {
    productName: "Outage Response",
    archetype: "CONSUMER_ALIGNED" as const,
    tier: "GOLD" as const,
    scopeBoundary: "Covers active outage dispatch; excludes billing.",
    valueHypothesis: "Unblocks the dispatch supervisor's crew-priority decision.",
    successMeasures: [{ measure: "Mean time to dispatch", target: "< 10 min" }],
  };

  it("rejects an invalid archetype", () => {
    expect(CharterBody.safeParse({ ...charter, archetype: "WHATEVER" }).success).toBe(false);
  });

  it("requires at least one success measure", () => {
    expect(CharterBody.safeParse({ ...charter, successMeasures: [] }).success).toBe(false);
  });

  it("renders deterministic markdown containing the value hypothesis", () => {
    const md = renderCharterMarkdown(CharterBody.parse(charter));
    expect(md).toContain("# Charter — Outage Response");
    expect(md).toContain(charter.valueHypothesis);
    expect(md).toContain("| Mean time to dispatch | < 10 min |");
    // Deterministic: same input, same output.
    expect(renderCharterMarkdown(CharterBody.parse(charter))).toBe(md);
  });
});

describe("SOURCE_INVENTORY body schema", () => {
  const source = {
    name: "Outage events",
    system: "SCADA",
    connectionKind: "DATABASE" as const,
    description: "One row per outage event.",
    feasibility: "READY" as const,
  };

  it("requires at least one source", () => {
    expect(SourceInventoryBody.safeParse({ sources: [] }).success).toBe(false);
  });

  it("rejects an invalid connection kind or feasibility", () => {
    expect(
      SourceInventoryBody.safeParse({ sources: [{ ...source, connectionKind: "SMOKE" }] }).success,
    ).toBe(false);
    expect(
      SourceInventoryBody.safeParse({ sources: [{ ...source, feasibility: "MAYBE" }] }).success,
    ).toBe(false);
  });

  it("accepts a valid source and defaults the gap log", () => {
    const parsed = SourceInventoryBody.parse({ sources: [source] });
    expect(parsed.sources).toHaveLength(1);
    expect(parsed.gapLog).toBe("");
  });
});

describe("artifact schema registry", () => {
  it("knows the kinds that have body schemas", () => {
    expect(hasArtifactSchema("WORKSPACE_SETUP")).toBe(true);
    expect(hasArtifactSchema("DECISION_REGISTER")).toBe(true);
    expect(hasArtifactSchema("CHARTER")).toBe(true);
    expect(hasArtifactSchema("OPERATIONS_LOG")).toBe(false);
  });

  it("validates the workspace setup body and rejects a missing pack", () => {
    expect(() =>
      parseArtifactBody("WORKSPACE_SETUP", {
        workspaceSlug: "demo",
        workspaceName: "Demo",
        industryPack: "utility",
        productSlug: "p",
        productName: "P",
      }),
    ).not.toThrow();
    expect(() =>
      parseArtifactBody("WORKSPACE_SETUP", {
        workspaceSlug: "demo",
        workspaceName: "Demo",
        industryPack: "",
        productSlug: "p",
        productName: "P",
      }),
    ).toThrow();
  });

  it("maps DECISION_REGISTER to a yaml mirror", () => {
    expect(getArtifactSchema("DECISION_REGISTER").format).toBe("yaml");
    expect(getArtifactSchema("DECISION_REGISTER").slug).toBe("decision-register");
  });

  it("maps CHARTER to a markdown mirror", () => {
    expect(getArtifactSchema("CHARTER").format).toBe("markdown");
  });

  it("throws a typed error for a kind with no schema", () => {
    expect(() => getArtifactSchema("OPERATIONS_LOG")).toThrow(UnknownArtifactSchemaError);
  });

  it("parseArtifactBody validates through the registry", () => {
    expect(() => parseArtifactBody("DECISION_REGISTER", { decisions: [] })).toThrow();
  });
});
