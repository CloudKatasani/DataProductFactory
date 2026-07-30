import { z } from "zod";

/**
 * Stage 0 primary artifact — the workspace.yaml the lifecycle table calls for.
 * It records what a product was set up as: the workspace it belongs to, the
 * industry pack in force, and the product's identity. Committing it is what
 * gives Stage 0 something for the Platform Admin to approve, so a new product
 * enters the lifecycle through the same gate machinery as every later stage
 * rather than a back door.
 */
export const WorkspaceSetupBody = z.object({
  workspaceSlug: z.string().trim().min(1),
  workspaceName: z.string().trim().min(1),
  /** Pack id in force for the workspace. Industry behaviour is data. */
  industryPack: z.string().trim().min(1),
  productSlug: z.string().trim().min(1),
  productName: z.string().trim().min(1),
});
export type WorkspaceSetupBody = z.infer<typeof WorkspaceSetupBody>;
