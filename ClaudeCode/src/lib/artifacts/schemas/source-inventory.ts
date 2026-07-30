import { z } from "zod";

/**
 * Stage 3 primary artifact — source-inventory.yaml. It records the candidate
 * source systems, how each is reached, and a feasibility read plus a gap log.
 * Consumption still leads (Non-Negotiable 1): sources are captured as supporting
 * detail for the stage-1 decision, never as the reason the product exists.
 */

export const ConnectionKind = z.enum(["DATABASE", "API", "FILE", "STREAM", "OTHER"]);
export type ConnectionKind = z.infer<typeof ConnectionKind>;

/** How ready a source is to be used, from the profiling pass. */
export const Feasibility = z.enum(["READY", "GAPS", "BLOCKED"]);
export type Feasibility = z.infer<typeof Feasibility>;

export const SourceRecord = z.object({
  name: z.string().trim().min(1, "name the source"),
  /** The system of record, e.g. "SCADA", "CIS", "Billing". */
  system: z.string().trim().min(1, "name the source system"),
  connectionKind: ConnectionKind,
  description: z.string().trim().min(1, "say what this source provides"),
  feasibility: Feasibility,
});
export type SourceRecord = z.infer<typeof SourceRecord>;

export const SourceInventoryBody = z.object({
  sources: z.array(SourceRecord).min(1, "at least one source is required"),
  /** Feasibility & gap log — what is missing or risky across the sources. */
  gapLog: z.string().trim().default(""),
});
export type SourceInventoryBody = z.infer<typeof SourceInventoryBody>;
