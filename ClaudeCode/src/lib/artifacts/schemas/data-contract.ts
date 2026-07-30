import { z } from "zod";

/**
 * Stage 5 artifact — the data contract. It pins the schema, an SLA, quality
 * thresholds, a version and a deprecation policy. Versioning and deprecation are
 * required: a contract a consumer cannot rely on across changes is not a
 * contract.
 */
export const ContractField = z.object({
  name: z.string().trim().min(1),
  type: z.string().trim().min(1),
  required: z.boolean().default(true),
});
export type ContractField = z.infer<typeof ContractField>;

export const QualityThreshold = z.object({
  rule: z.string().trim().min(1),
  threshold: z.string().trim().min(1),
});
export type QualityThreshold = z.infer<typeof QualityThreshold>;

export const DataContractBody = z.object({
  /** Contract version, semver. Consumers pin to this. */
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "must be semver, e.g. 1.0.0"),
  fields: z.array(ContractField).min(1, "a contract needs at least one field"),
  sla: z.object({
    freshness: z.string().trim().min(1, "state the freshness SLA"),
    availability: z.string().trim().default(""),
  }),
  qualityThresholds: z.array(QualityThreshold).default([]),
  deprecationPolicy: z
    .string()
    .trim()
    .min(1, "state how the contract is deprecated and how much notice consumers get"),
});
export type DataContractBody = z.infer<typeof DataContractBody>;
