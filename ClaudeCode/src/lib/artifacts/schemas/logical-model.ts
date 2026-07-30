import { z } from "zod";

/**
 * Stage 4 primary artifact — the conceptual & logical model. It states the grain
 * the product is defined at, the entities and their grains, how they bind to the
 * pack's conformed backbone, and the identity-resolution strategy. Grain and
 * identity are required: a model that cannot say what one row means, or how two
 * records become the same entity, is not yet a model.
 */

export const EntityDefinition = z.object({
  name: z.string().trim().min(1, "name the entity"),
  grain: z.string().trim().min(1, "state the entity's grain"),
  description: z.string().trim().default(""),
});
export type EntityDefinition = z.infer<typeof EntityDefinition>;

/** Binds a pack conformed-backbone entity to a local entity in this model. */
export const BackboneBinding = z.object({
  backboneEntity: z.string().trim().min(1),
  boundEntity: z.string().trim().min(1),
});
export type BackboneBinding = z.infer<typeof BackboneBinding>;

export const LogicalModelBody = z.object({
  grainStatement: z.string().trim().min(1, "state the product's grain"),
  entities: z.array(EntityDefinition).min(1, "at least one entity is required"),
  conformedBindings: z.array(BackboneBinding).default([]),
  identityResolution: z
    .string()
    .trim()
    .min(1, "state how records are resolved to one entity"),
});
export type LogicalModelBody = z.infer<typeof LogicalModelBody>;
