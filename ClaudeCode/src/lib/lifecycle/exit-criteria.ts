import type { ArtifactKind } from "@/lib/artifacts/enums";
import type { CriterionResult, ExitCriterion, StageEvaluationContext } from "./types";

/** Criterion: an artifact of this kind has at least one committed version. */
export function requiresArtifact(kind: ArtifactKind, label: string): ExitCriterion {
  return (ctx: StageEvaluationContext): CriterionResult => {
    const found = ctx.artifacts.find((a) => a.kind === kind);
    return {
      id: `artifact:${kind}`,
      label,
      passed: found !== undefined,
      detail: found
        ? `${kind} committed at version ${found.versionNumber}.`
        : `No committed ${kind} on this product.`,
      artifactRef: found?.slug,
    };
  };
}

/**
 * Non-negotiable 1. A data product cannot exist without a named consumer and a
 * blocked decision, so this is what hard-blocks stage 2.
 */
export const requiresCompleteDecisionRecord: ExitCriterion = (ctx) => {
  const complete = ctx.decisionRecords.filter(
    (d) =>
      d.persona.trim() !== "" &&
      d.decision.trim() !== "" &&
      d.cadence.trim() !== "" &&
      d.consequence.trim() !== "",
  );
  const incomplete = ctx.decisionRecords.length - complete.length;
  return {
    id: "decision-register:complete",
    label: "At least one decision record names a persona, decision, cadence and consequence",
    passed: complete.length > 0,
    detail:
      complete.length > 0
        ? `${complete.length} complete decision record(s).`
        : ctx.decisionRecords.length === 0
          ? "No decision records. Stage 2 stays locked until a real consumer and a blocked decision are named."
          : `${incomplete} decision record(s) present but all are missing at least one required field.`,
  };
};

/**
 * Non-negotiable 10. Stage 9 cannot gate while any attribute is unclassified.
 */
export const requiresFullClassification: ExitCriterion = (ctx) => {
  const unclassified = ctx.attributes.filter((a) => a.sensitivity === null);
  const total = ctx.attributes.length;
  return {
    id: "attributes:classified",
    label: "100% of attributes carry a sensitivity classification",
    passed: total > 0 && unclassified.length === 0,
    detail:
      total === 0
        ? "No attributes registered. Stage 5 must produce an attribute register first."
        : unclassified.length === 0
          ? `All ${total} attributes classified.`
          : `${unclassified.length} of ${total} unclassified: ${unclassified
              .slice(0, 5)
              .map((a) => a.name)
              .join(", ")}${unclassified.length > 5 ? "…" : ""}`,
  };
};

/**
 * Non-negotiable 8. Duplicate metric names are a validation error, not a naming
 * discussion. The database enforces this per workspace; this surfaces it in the
 * checklist before the write fails.
 */
export const requiresUniqueCertifiedMetrics: ExitCriterion = (ctx) => {
  const seen = new Map<string, number>();
  for (const m of ctx.metrics) {
    const key = m.name.trim().toLowerCase();
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  const duplicates = [...seen.entries()].filter(([, n]) => n > 1).map(([name]) => name);
  const certified = ctx.metrics.filter((m) => m.certified);
  return {
    id: "metrics:unique-and-certified",
    label: "Every metric has exactly one certified definition",
    passed: duplicates.length === 0 && certified.length > 0,
    detail:
      duplicates.length > 0
        ? `Duplicate metric names: ${duplicates.join(", ")}`
        : certified.length === 0
          ? "No certified metrics yet."
          : `${certified.length} certified metric(s), no duplicates.`,
  };
};
