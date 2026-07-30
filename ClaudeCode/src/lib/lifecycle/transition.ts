import { FIRST_STAGE, getStage } from "./stages";
import type { CriterionResult, StageEvaluationContext } from "./types";
import { exitCriteriaUnmet, stageLocked } from "@/lib/governance/errors";
import type { GateStatus } from "@/lib/artifacts/enums";

/**
 * The transition engine. It reads the same exit-criteria list the checklist UI
 * renders, so a stage can never look ready on screen and be refused here.
 */

export interface StageReadiness {
  stageNumber: number;
  criteria: CriterionResult[];
  /** True when every criterion passes. */
  ready: boolean;
}

export function evaluateStage(
  stageNumber: number,
  ctx: StageEvaluationContext,
): StageReadiness {
  const stage = getStage(stageNumber);
  const criteria = stage.exitCriteria.map((check) => check(ctx));
  return { stageNumber, criteria, ready: criteria.every((c) => c.passed) };
}

/**
 * A stage is unlocked when every prior stage's gate is APPROVED. STALE does not
 * count — that is the whole point of cascade invalidation.
 */
export function isStageUnlocked(
  stageNumber: number,
  gateStatusByStage: ReadonlyMap<number, GateStatus>,
): { unlocked: true } | { unlocked: false; blockingStage: number } {
  for (let n = FIRST_STAGE; n < stageNumber; n++) {
    if (gateStatusByStage.get(n) !== "APPROVED") {
      return { unlocked: false, blockingStage: n };
    }
  }
  return { unlocked: true };
}

/**
 * Guard for moving a stage into review. Throws typed governance errors rather
 * than returning false, so no caller can accidentally ignore the result.
 */
export function assertCanEnterReview(
  stageNumber: number,
  ctx: StageEvaluationContext,
  gateStatusByStage: ReadonlyMap<number, GateStatus>,
): void {
  const lock = isStageUnlocked(stageNumber, gateStatusByStage);
  if (!lock.unlocked) {
    throw stageLocked(stageNumber, lock.blockingStage);
  }

  const readiness = evaluateStage(stageNumber, ctx);
  if (!readiness.ready) {
    throw exitCriteriaUnmet(
      stageNumber,
      readiness.criteria.filter((c) => !c.passed).map((c) => c.detail),
    );
  }
}
