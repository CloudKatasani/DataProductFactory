import { z } from "zod";

/**
 * Stage 2 primary artifact. Serialized as Markdown (it is a narrative document),
 * so its committed body is a single rendered string — but it is authored from
 * this structured shape and validated before rendering, so a charter can never
 * be committed without an archetype, a tier, or a value hypothesis.
 *
 * Non-Negotiable 1 again: the value hypothesis must reference the consumer
 * decision from stage 1, not a pipeline or a tool.
 */

export const Archetype = z.enum([
  "SOURCE_ALIGNED",
  "AGGREGATE",
  "CONSUMER_ALIGNED",
]);
export type Archetype = z.infer<typeof Archetype>;

export const Tier = z.enum(["BRONZE", "SILVER", "GOLD", "PLATINUM"]);
export type Tier = z.infer<typeof Tier>;

export const SuccessMeasure = z.object({
  measure: z.string().trim().min(1),
  target: z.string().trim().min(1),
});
export type SuccessMeasure = z.infer<typeof SuccessMeasure>;

export const CharterBody = z.object({
  productName: z.string().trim().min(1),
  archetype: Archetype,
  tier: Tier,
  /** What this product is and, as importantly, is not. */
  scopeBoundary: z.string().trim().min(1, "state what is in and out of scope"),
  /** Must tie back to the stage-1 decision. */
  valueHypothesis: z
    .string()
    .trim()
    .min(1, "state the value hypothesis in terms of the consumer decision it unblocks"),
  successMeasures: z
    .array(SuccessMeasure)
    .min(1, "a charter needs at least one measurable success measure"),
});
export type CharterBody = z.infer<typeof CharterBody>;

/** Deterministic Markdown rendering — the string body that gets committed. */
export function renderCharterMarkdown(body: CharterBody): string {
  const measures = body.successMeasures
    .map((m) => `| ${m.measure} | ${m.target} |`)
    .join("\n");
  return [
    `# Charter — ${body.productName}`,
    "",
    `- **Archetype:** ${body.archetype}`,
    `- **Tier:** ${body.tier}`,
    "",
    "## Scope boundary",
    "",
    body.scopeBoundary,
    "",
    "## Value hypothesis",
    "",
    body.valueHypothesis,
    "",
    "## Success measures",
    "",
    "| Measure | Target |",
    "| --- | --- |",
    measures,
    "",
  ].join("\n");
}
