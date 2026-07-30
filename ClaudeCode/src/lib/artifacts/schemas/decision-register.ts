import { z } from "zod";

/**
 * Stage 1 primary artifact (Non-Negotiable 1: consumption-first).
 *
 * The register is the committed, versioned, Git-mirrored document. It packages
 * the live DecisionRecord rows the exit criteria read, plus the supporting
 * consumer personas and question inventory the stage produces. A product cannot
 * advance without at least one *complete* decision record here — the same rule
 * `requiresCompleteDecisionRecord` enforces on the live rows.
 */

export const DecisionRecordBody = z.object({
  /** The named human who cannot make this decision today. */
  persona: z.string().trim().min(1, "name the persona who is blocked"),
  /** Stated as a decision, not a report request. */
  decision: z.string().trim().min(1, "state the decision that cannot be made"),
  /** How often it must be made, e.g. "daily", "per outage". */
  cadence: z.string().trim().min(1, "state how often the decision is made"),
  /** What goes wrong when it is not made. */
  consequence: z.string().trim().min(1, "state the consequence of not deciding"),
});
export type DecisionRecordBody = z.infer<typeof DecisionRecordBody>;

export const ConsumerPersona = z.object({
  name: z.string().trim().min(1),
  role: z.string().trim().default(""),
  goal: z.string().trim().default(""),
});
export type ConsumerPersona = z.infer<typeof ConsumerPersona>;

export const InventoryQuestion = z.object({
  question: z.string().trim().min(1),
  /** The persona name this question belongs to; free text so it can predate personas. */
  askedBy: z.string().trim().default(""),
});
export type InventoryQuestion = z.infer<typeof InventoryQuestion>;

export const DecisionRegisterBody = z.object({
  /**
   * At least one decision record, each complete. The transition guard also
   * enforces completeness on the live rows, but validating here means a
   * committed register can never be internally invalid.
   */
  decisions: z.array(DecisionRecordBody).min(1, "at least one blocked decision is required"),
  personas: z.array(ConsumerPersona).default([]),
  questions: z.array(InventoryQuestion).default([]),
  /** Free-text narrative of what is painful about the current state. */
  currentStatePain: z.string().trim().default(""),
});
export type DecisionRegisterBody = z.infer<typeof DecisionRegisterBody>;
