import { describe, expect, it } from "vitest";
import {
  requiresCompleteDecisionRecord,
  requiresFullClassification,
  requiresUniqueCertifiedMetrics,
} from "@/lib/lifecycle/exit-criteria";
import type { StageEvaluationContext } from "@/lib/lifecycle/types";

function ctx(overrides: Partial<StageEvaluationContext> = {}): StageEvaluationContext {
  return {
    productId: "p1",
    decisionRecords: [],
    attributes: [],
    metrics: [],
    artifacts: [],
    ...overrides,
  };
}

describe("non-negotiable 1 — consumption first", () => {
  it("fails with no decision records at all", () => {
    expect(requiresCompleteDecisionRecord(ctx()).passed).toBe(false);
  });

  it("fails when a decision record is missing its consequence", () => {
    const result = requiresCompleteDecisionRecord(
      ctx({
        decisionRecords: [
          { persona: "Dispatcher", decision: "Which crew to send", cadence: "15m", consequence: "" },
        ],
      }),
    );
    expect(result.passed).toBe(false);
    expect(result.detail).toMatch(/missing at least one required field/);
  });

  it("passes with one complete record", () => {
    const result = requiresCompleteDecisionRecord(
      ctx({
        decisionRecords: [
          {
            persona: "Dispatcher",
            decision: "Which crew to send",
            cadence: "15m",
            consequence: "Crews idle while customers stay dark",
          },
        ],
      }),
    );
    expect(result.passed).toBe(true);
  });

  it("does not accept whitespace as a filled field", () => {
    const result = requiresCompleteDecisionRecord(
      ctx({
        decisionRecords: [
          { persona: "  ", decision: "d", cadence: "c", consequence: "x" },
        ],
      }),
    );
    expect(result.passed).toBe(false);
  });
});

describe("non-negotiable 10 — classification before access", () => {
  it("fails when the register is empty", () => {
    expect(requiresFullClassification(ctx()).passed).toBe(false);
  });

  it("fails while any attribute is unclassified, and names it", () => {
    const result = requiresFullClassification(
      ctx({
        attributes: [
          { name: "meter_id", sensitivity: "INTERNAL" },
          { name: "customer_ssn", sensitivity: null },
        ],
      }),
    );
    expect(result.passed).toBe(false);
    expect(result.detail).toContain("customer_ssn");
  });

  it("passes only at 100%", () => {
    const result = requiresFullClassification(
      ctx({
        attributes: [
          { name: "meter_id", sensitivity: "INTERNAL" },
          { name: "customer_ssn", sensitivity: "RESTRICTED" },
        ],
      }),
    );
    expect(result.passed).toBe(true);
  });
});

describe("non-negotiable 8 — one metric, one definition", () => {
  it("fails on a duplicate name regardless of case", () => {
    const result = requiresUniqueCertifiedMetrics(
      ctx({
        metrics: [
          { name: "Outage Duration", definition: "a", certified: true },
          { name: "outage duration", definition: "b", certified: true },
        ],
      }),
    );
    expect(result.passed).toBe(false);
    expect(result.detail).toMatch(/duplicate/i);
  });

  it("fails when nothing is certified yet", () => {
    const result = requiresUniqueCertifiedMetrics(
      ctx({ metrics: [{ name: "Outage Duration", definition: "a", certified: false }] }),
    );
    expect(result.passed).toBe(false);
  });

  it("passes with unique certified metrics", () => {
    const result = requiresUniqueCertifiedMetrics(
      ctx({
        metrics: [
          { name: "Outage Duration", definition: "a", certified: true },
          { name: "Crews Dispatched", definition: "b", certified: true },
        ],
      }),
    );
    expect(result.passed).toBe(true);
  });
});
