import type { ZodType } from "zod";
import type { ArtifactKind } from "@/lib/artifacts/enums";
import type { MirrorFormat } from "@/lib/artifacts/mirror";
import { WorkspaceSetupBody } from "./workspace-setup";
import { DecisionRegisterBody } from "./decision-register";
import { CharterBody } from "./charter";
import { SourceInventoryBody } from "./source-inventory";

/**
 * The artifact schema registry. `commitArtifact` trusts its caller to have
 * validated the body; this is where that validation comes from, so a body and
 * its Zod schema can never drift apart. One entry per artifact kind that has a
 * defined body schema yet — kinds are added here as their stages are built out.
 *
 * `format` is the on-disk mirror format for the kind (Non-Negotiable 7). YAML
 * for structured data, markdown for narrative documents.
 */
export interface ArtifactSchemaEntry {
  schema: ZodType;
  format: MirrorFormat;
  /** Default file/identity stem within a product, e.g. "decision-register". */
  slug: string;
}

const REGISTRY: Partial<Record<ArtifactKind, ArtifactSchemaEntry>> = {
  WORKSPACE_SETUP: {
    schema: WorkspaceSetupBody,
    format: "yaml",
    slug: "workspace",
  },
  DECISION_REGISTER: {
    schema: DecisionRegisterBody,
    format: "yaml",
    slug: "decision-register",
  },
  CHARTER: {
    // Charter is authored structured, rendered to markdown for the mirror; the
    // body validated here is the structured shape (see charter.ts).
    schema: CharterBody,
    format: "markdown",
    slug: "charter",
  },
  SOURCE_INVENTORY: {
    schema: SourceInventoryBody,
    format: "yaml",
    slug: "source-inventory",
  },
};

export class UnknownArtifactSchemaError extends Error {
  constructor(kind: ArtifactKind) {
    super(
      `No body schema registered for artifact kind ${kind}. Add one in src/lib/artifacts/schemas/ before committing this kind.`,
    );
    this.name = "UnknownArtifactSchemaError";
  }
}

export function getArtifactSchema(kind: ArtifactKind): ArtifactSchemaEntry {
  const entry = REGISTRY[kind];
  if (!entry) throw new UnknownArtifactSchemaError(kind);
  return entry;
}

export function hasArtifactSchema(kind: ArtifactKind): boolean {
  return REGISTRY[kind] !== undefined;
}

/**
 * Validate a body against its kind's schema, returning the parsed value. Throws
 * a Zod error with field-level messages the UI can surface. This is the call
 * every write path makes before `commitArtifact`.
 */
export function parseArtifactBody(kind: ArtifactKind, body: unknown): unknown {
  return getArtifactSchema(kind).schema.parse(body);
}

export { WorkspaceSetupBody } from "./workspace-setup";
export { DecisionRegisterBody } from "./decision-register";
export { CharterBody, renderCharterMarkdown } from "./charter";
export { SourceInventoryBody } from "./source-inventory";
