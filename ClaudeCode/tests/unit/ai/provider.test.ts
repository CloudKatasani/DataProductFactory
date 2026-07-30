import { describe, expect, it } from "vitest";
import { DEFAULT_MODEL, getDraftModelClient, readLlmConfig } from "@/lib/ai/provider";

/**
 * The provider is the single switch for the optional LLM assist (Non-Negotiable
 * 6). No key means no provider means the app stays fully manual — these tests
 * pin that behaviour and the env-driven, non-hardcoded model selection.
 */
describe("LLM provider configuration", () => {
  it("returns null when no API key is set — assist is off", () => {
    expect(readLlmConfig({})).toBeNull();
    expect(readLlmConfig({ DPF_LLM_MODEL: "whatever" })).toBeNull();
    expect(getDraftModelClient({})).toBeNull();
  });

  it("treats a blank or whitespace key as no key", () => {
    expect(readLlmConfig({ DPF_LLM_API_KEY: "   " })).toBeNull();
    expect(getDraftModelClient({ DPF_LLM_API_KEY: "" })).toBeNull();
  });

  it("defaults the model when only a key is given", () => {
    const config = readLlmConfig({ DPF_LLM_API_KEY: "sk-test" });
    expect(config).not.toBeNull();
    expect(config?.model).toBe(DEFAULT_MODEL);
    expect(config?.baseUrl).toBeUndefined();
  });

  it("honours an explicit model and base URL", () => {
    const config = readLlmConfig({
      DPF_LLM_API_KEY: "sk-test",
      DPF_LLM_MODEL: "claude-sonnet-5",
      DPF_LLM_BASE_URL: "https://gateway.internal/v1",
    });
    expect(config?.model).toBe("claude-sonnet-5");
    expect(config?.baseUrl).toBe("https://gateway.internal/v1");
  });

  it("builds a client when a key is present", () => {
    expect(getDraftModelClient({ DPF_LLM_API_KEY: "sk-test" })).not.toBeNull();
  });
});
