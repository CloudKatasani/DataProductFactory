import { z } from "zod";
import { Sensitivity } from "@/lib/artifacts/enums";

/**
 * Stage 5 artifact — the attribute register. Every attribute carries a
 * sensitivity classification and a PII flag (Non-Negotiable 10). Sensitivity is
 * nullable on purpose: an attribute may be registered before it is classified,
 * and it is exactly those unclassified attributes that keep Stage 9 (Access &
 * Governance) blocked until the register is 100% classified.
 */
export const AttributeRecord = z.object({
  name: z.string().trim().min(1, "name the attribute"),
  dataType: z.string().trim().min(1, "state the data type"),
  /** Null means unclassified — which is what blocks Stage 9. */
  sensitivity: Sensitivity.nullable().default(null),
  piiFlag: z.boolean().default(false),
  /** Comma-separated regulatory tags, e.g. "GDPR,HIPAA". Empty when none apply. */
  regulatoryFlags: z.string().trim().default(""),
});
export type AttributeRecord = z.infer<typeof AttributeRecord>;

export const AttributeRegisterBody = z.object({
  attributes: z.array(AttributeRecord).min(1, "at least one attribute is required"),
});
export type AttributeRegisterBody = z.infer<typeof AttributeRegisterBody>;
