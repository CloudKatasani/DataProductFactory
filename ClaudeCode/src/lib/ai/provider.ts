import Anthropic from "@anthropic-ai/sdk";

/**
 * The optional LLM assist provider (Non-Negotiable 6: local-first, offline-
 * capable). Nothing here runs unless the operator has supplied an API key via
 * the environment. When no key is present `getDraftModelClient` returns null and
 * every caller degrades to fully manual authoring — the assist is a convenience,
 * never a dependency.
 *
 * The client is a narrow interface, not the Anthropic SDK type, so the assist
 * engine and its tests depend only on `generate(...)` and can inject a fake
 * without touching the network.
 */

/**
 * Default model when `DPF_LLM_MODEL` is unset. Env-overridable on purpose so an
 * operator can pin whatever model their key is entitled to — the code never
 * hardcodes a single required model.
 */
export const DEFAULT_MODEL = "claude-opus-5";

export interface LlmConfig {
  apiKey: string;
  model: string;
  /** Optional gateway/base URL, e.g. a self-hosted proxy. */
  baseUrl?: string;
}

/**
 * Read LLM configuration from the environment. Returns null — meaning "assist is
 * off" — whenever no API key is present. The key is the single switch: without
 * it there is no provider, and the UI stays fully manual.
 */
export function readLlmConfig(env: Record<string, string | undefined> = process.env): LlmConfig | null {
  const apiKey = env.DPF_LLM_API_KEY?.trim();
  if (!apiKey) return null;
  return {
    apiKey,
    model: env.DPF_LLM_MODEL?.trim() || DEFAULT_MODEL,
    baseUrl: env.DPF_LLM_BASE_URL?.trim() || undefined,
  };
}

/** A single structured-draft request. The schema constrains the model's output. */
export interface DraftRequest {
  system: string;
  user: string;
  /** Tool name the model must call; matches ^[a-zA-Z0-9_-]{1,64}$. */
  toolName: string;
  toolDescription: string;
  /** JSON Schema (object) the tool input must conform to. */
  schema: Record<string, unknown>;
}

/**
 * The seam the assist engine depends on. The real implementation talks to the
 * Anthropic API; tests provide a fake. `generate` returns the raw, *unvalidated*
 * object the model produced — the assist engine is responsible for validating it
 * against the artifact's Zod schema, so a malformed model response is caught and
 * surfaced rather than trusted.
 */
export interface DraftModelClient {
  generate(req: DraftRequest): Promise<unknown>;
}

class AnthropicDraftClient implements DraftModelClient {
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(config: LlmConfig) {
    this.client = new Anthropic({ apiKey: config.apiKey, baseURL: config.baseUrl });
    this.model = config.model;
  }

  async generate(req: DraftRequest): Promise<unknown> {
    // Forced tool use is the structured-output mechanism: the model must call
    // our single tool, and its input is the draft we validate downstream.
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system: req.system,
      tools: [
        {
          name: req.toolName,
          description: req.toolDescription,
          input_schema: req.schema as Anthropic.Tool.InputSchema,
        },
      ],
      tool_choice: { type: "tool", name: req.toolName },
      messages: [{ role: "user", content: req.user }],
    });

    const block = response.content.find((b) => b.type === "tool_use");
    if (!block || block.type !== "tool_use") {
      throw new Error("The assistant did not return a structured draft.");
    }
    return block.input;
  }
}

/**
 * Build the draft client from the environment, or null when assist is off. This
 * is the only place the concrete Anthropic client is constructed.
 */
export function getDraftModelClient(
  env: Record<string, string | undefined> = process.env,
): DraftModelClient | null {
  const config = readLlmConfig(env);
  if (!config) return null;
  return new AnthropicDraftClient(config);
}
