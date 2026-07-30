import type { ZodType } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { ArtifactKind } from "@/lib/artifacts/enums";
import { getArtifactSchema } from "@/lib/artifacts/schemas";
import type { DraftModelClient } from "./provider";

/**
 * Propose-only AI assist (Non-Negotiable 3). `draftArtifact` asks the model for
 * a draft of an artifact body, then validates that draft against the very same
 * Zod schema the human authoring path uses. The result is never persisted here
 * and never carries approval — it is a suggestion the owner reviews, edits, and
 * commits as their own work. The model can propose; only a human can author or
 * approve.
 */

/** Assist was requested but no provider is configured (no API key). */
export class AssistUnavailableError extends Error {
  constructor() {
    super(
      "AI assist is not configured. Set DPF_LLM_API_KEY to enable it, or author this artifact manually.",
    );
    this.name = "AssistUnavailableError";
  }
}

/** The model responded, but its draft did not satisfy the artifact's schema. */
export class AssistDraftError extends Error {
  constructor(kind: ArtifactKind, detail: string) {
    super(`The assistant's ${kind} draft was not valid: ${detail}`);
    this.name = "AssistDraftError";
  }
}

export interface DraftContext {
  productName: string;
  workspaceName: string;
  industryPack: string;
  /**
   * Grounding pulled from upstream, approved context — e.g. the stage-1
   * decisions when drafting a charter. Free text; keeps the draft anchored to
   * the consumer decision (Non-Negotiable 1) rather than inventing one.
   */
  groundingNotes?: string;
}

/** What a good artifact of each kind is — steers the draft toward DPF norms. */
const KIND_GUIDANCE: Partial<Record<ArtifactKind, string>> = {
  DECISION_REGISTER:
    "Capture blocked business decisions. Each decision names the human persona who is blocked, the decision they cannot make today, how often they must make it (cadence), and the concrete consequence of not making it. Start from the consumer, never from a pipeline or tool.",
  CHARTER:
    "Write a product charter. The value hypothesis MUST name the consumer decision from stage 1 that this product unblocks — not a pipeline, tool, or dataset. Set a realistic archetype and tier, a crisp scope boundary (what is in and explicitly out), and at least one measurable success measure with a target.",
  SOURCE_INVENTORY:
    "Inventory the source systems that could feed this product. For each source give a name, the system it lives in, its connection kind, a one-line description, and a feasibility rating. Note what is missing or risky in the gap log. Sources are supporting detail for the consumer decision, not the point.",
  LOGICAL_MODEL:
    "Describe the conceptual and logical model: a clear grain statement, the core entities with their grain, and an identity-resolution strategy. Keep it business-level, not physical tables.",
  ATTRIBUTE_REGISTER:
    "List the attributes this product will expose. For each give a name and data type. Leave sensitivity unset unless you are confident — a human data steward classifies these, and an over-confident guess is worse than an honest blank.",
  DATA_CONTRACT:
    "Draft a consumer-facing data contract: a semver version, the schema fields with types, a freshness SLA, and a deprecation policy that tells consumers how breaking changes are handled.",
};

function toolNameFor(slug: string): string {
  return `draft_${slug.replace(/-/g, "_")}`.slice(0, 64);
}

function jsonSchemaFor(schema: ZodType): Record<string, unknown> {
  const json = zodToJsonSchema(schema, { $refStrategy: "none", target: "jsonSchema7" }) as Record<
    string,
    unknown
  >;
  // Anthropic tool input schemas are self-contained; drop the meta key.
  delete json.$schema;
  return json;
}

function buildSystemPrompt(kind: ArtifactKind, guidance: string): string {
  return [
    "You are an assistant inside the Data Product Factory, a governed tool for designing data products.",
    "You produce DRAFTS only. A human owner reviews, edits, and commits your work — you never approve anything and your output is always marked as an AI draft until a human accepts it.",
    "Consumption comes first: every artifact serves a named consumer's blocked decision, never a pipeline or tool.",
    `You are drafting a ${kind}. ${guidance}`,
    "Call the provided tool exactly once with a complete, self-consistent draft. Do not include commentary outside the tool call. Prefer leaving a field blank over inventing an unsupported fact.",
  ].join("\n");
}

function buildUserPrompt(context: DraftContext): string {
  const lines = [
    `Workspace: ${context.workspaceName}`,
    `Industry pack: ${context.industryPack}`,
    `Data product: ${context.productName}`,
  ];
  if (context.groundingNotes?.trim()) {
    lines.push("", "Context from earlier, approved stages:", context.groundingNotes.trim());
  }
  lines.push("", "Draft this artifact now by calling the tool.");
  return lines.join("\n");
}

/**
 * Ask the model for a schema-valid draft of `kind`. Throws
 * `AssistUnavailableError` when assist is off (no client), and
 * `AssistDraftError` when the model's output fails validation. On success it
 * returns the parsed body — the same shape the manual editor produces.
 */
export async function draftArtifact(
  kind: ArtifactKind,
  context: DraftContext,
  client: DraftModelClient | null,
): Promise<unknown> {
  if (!client) throw new AssistUnavailableError();

  const entry = getArtifactSchema(kind);
  const guidance = KIND_GUIDANCE[kind] ?? "Produce a complete, valid draft of this artifact.";

  const raw = await client.generate({
    system: buildSystemPrompt(kind, guidance),
    user: buildUserPrompt(context),
    toolName: toolNameFor(entry.slug),
    toolDescription: `Return a complete, valid ${kind} draft.`,
    schema: jsonSchemaFor(entry.schema),
  });

  // The model is untrusted: validate its draft through the artifact schema, the
  // exact gate a human author's input passes. A bad draft becomes a typed error,
  // never a silently-wrong artifact.
  const parsed = entry.schema.safeParse(raw);
  if (!parsed.success) {
    const detail = parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
    throw new AssistDraftError(kind, detail);
  }
  return parsed.data;
}
