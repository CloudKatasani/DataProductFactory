import { describe, expect, it } from "vitest";
import { assertCanEnterReview, isStageUnlocked } from "@/lib/lifecycle/transition";
import { LAST_STAGE, STAGES, getStage } from "@/lib/lifecycle/stages";
import type { GateStatus } from "@/lib/artifacts/enums";
import type { StageEvaluationContext } from "@/lib/lifecycle/types";

function gates(entries: Record<number, GateStatus>): ReadonlyMap<number, GateStatus> {
  return new Map(Object.entries(entries).map(([k, v]) => [Number(k), v]));
}

const EMPTY_CTX: StageEvaluationContext = {
  productId: "p1",
  decisionRecords: [],
  attributes: [],
  metrics: [],
  artifacts: [],
};

describe("the canonical lifecycle", () => {
  it("has 13 stages numbered 0 through 12 with no gaps", () => {
    expect(STAGES).toHaveLength(13);
    expect(STAGES.map((s) => s.number)).toEqual([...Array(13).keys()]);
    expect(LAST_STAGE).toBe(12);
  });

  it("gives every stage at least one required approver", () => {
    for (const stage of STAGES) {
      expect(stage.requiredApprovers.length, `stage ${stage.number}`).toBeGreaterThan(0);
    }
  });

  it("puts the privacy officer on stage 9, where the veto lives", () => {
    expect(getStage(9).requiredApprovers).toContain("PRIVACY_SECURITY_OFFICER");
  });

  it("refuses an unknown stage number rather than returning undefined", () => {
    expect(() => getStage(13)).toThrow(/Unknown stage 13/);
  });
});

describe("stage locking", () => {
  it("unlocks stage 0 unconditionally", () => {
    expect(isStageUnlocked(0, gates({}))).toEqual({ unlocked: true });
  });

  it("blocks a stage when a prior gate is not approved", () => {
    expect(isStageUnlocked(2, gates({ 0: "APPROVED", 1: "IN_REVIEW" }))).toEqual({
      unlocked: false,
      blockingStage: 1,
    });
  });

  it("treats STALE as not approved", () => {
    expect(isStageUnlocked(2, gates({ 0: "APPROVED", 1: "STALE" }))).toEqual({
      unlocked: false,
      blockingStage: 1,
    });
  });

  it("reports the earliest blocking stage", () => {
    expect(isStageUnlocked(5, gates({ 0: "APPROVED", 1: "DRAFT", 2: "DRAFT" }))).toEqual({
      unlocked: false,
      blockingStage: 1,
    });
  });
});

describe("assertCanEnterReview", () => {
  it("throws a stage-locked error naming the blocking stage", () => {
    expect(() => assertCanEnterReview(2, EMPTY_CTX, gates({ 0: "APPROVED", 1: "DRAFT" }))).toThrow(
      /Stage 2 is locked because stage 1 is not approved/,
    );
  });

  it("throws an exit-criteria error listing what is missing", () => {
    // Stage 1 is unlocked but has no decision register and no records.
    expect(() => assertCanEnterReview(1, EMPTY_CTX, gates({ 0: "APPROVED" }))).toThrow(
      /cannot enter review until these are resolved/,
    );
  });

  it("passes a stage with no exit criteria once it is unlocked", () => {
    expect(() => assertCanEnterReview(0, EMPTY_CTX, gates({}))).not.toThrow();
  });
});
