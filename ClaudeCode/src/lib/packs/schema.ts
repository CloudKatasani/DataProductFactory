import { z } from "zod";
import { Sensitivity } from "@/lib/artifacts/enums";

/**
 * Non-negotiable 11. Everything industry-specific is declared here and loaded as
 * data. If a change to industry behaviour requires editing TypeScript, the pack
 * schema is missing a field — extend this, not `src/`.
 */

const slug = z
  .string()
  .min(1)
  .regex(/^[a-z0-9][a-z0-9-]*$/, "must be lower-kebab-case");

/**
 * Pack ids additionally allow a leading underscore, reserved for the built-in
 * baseline `_generic`. The underscore sorts it first and marks it as not an
 * industry, so no real industry pack can collide with it.
 */
const packId = z
  .string()
  .min(1)
  .regex(/^_?[a-z0-9][a-z0-9-]*$/, "must be lower-kebab-case, optionally _-prefixed");

export const PackDomain = z.object({
  id: slug,
  name: z.string().min(1),
  description: z.string().default(""),
});

export const PackConformedEntity = z.object({
  id: slug,
  name: z.string().min(1),
  /** The grain this entity is defined at. Stage 4 binds to it. */
  grain: z.string().min(1),
  description: z.string().default(""),
});

export const PackRegulatoryConstraint = z.object({
  id: slug,
  /** e.g. "GDPR", "HIPAA", "NERC CIP" */
  name: z.string().min(1),
  /** Minimum classification any attribute under this constraint must carry. */
  minimumSensitivity: Sensitivity,
  note: z.string().default(""),
});

export const PackStarterMetric = z.object({
  id: slug,
  name: z.string().min(1),
  definition: z.string().min(1),
  /** Free text; becomes the lineagePath seed when the metric is adopted. */
  suggestedLineagePath: z.string().default(""),
});

export const Pack = z.object({
  /** Must equal the directory name under packs/. */
  id: packId,
  name: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "must be semver"),
  description: z.string().default(""),
  domains: z.array(PackDomain).default([]),
  conformedBackbone: z.array(PackConformedEntity).default([]),
  regulatoryConstraints: z.array(PackRegulatoryConstraint).default([]),
  starterMetrics: z.array(PackStarterMetric).default([]),
});

export type Pack = z.infer<typeof Pack>;
export type PackDomain = z.infer<typeof PackDomain>;
export type PackConformedEntity = z.infer<typeof PackConformedEntity>;
export type PackRegulatoryConstraint = z.infer<typeof PackRegulatoryConstraint>;
export type PackStarterMetric = z.infer<typeof PackStarterMetric>;
