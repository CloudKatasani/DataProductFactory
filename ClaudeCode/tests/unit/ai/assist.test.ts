import { describe, expect, it, vi } from "vitest";
import {
  AssistDraftError,
  AssistUnavailableError,
  draftArtifact,
  type DraftContext,
} from "@/lib/ai/assist";
import type { DraftModelClient, DraftRequest } from "@/lib/ai/provider";
import { ArtifactKind } from "@/lib/artifacts/enums";
import { hasArtifactSchema } from "@/lib/artifacts/schemas";

/**
 * The assist engine is propose-only (Non-Negotiable 3) and must never trust the
 * model: whatever it returns is validated through the same Zod schema the manual
 * editor uses. These tests inject a fake client — no network, fully hermetic.
 */

const context: DraftContext = {
  productName: "Outage Response",
  workspaceName: "Grid Ops",
  industryPack: "utility",
};

/** A client that always returns the same canned object. */
function fakeClient(payload: unknown): DraftModelClient {
  return { generate: vi.fn(async () => payload) };
}

const validCharter = {
  productName: "Outage Response",
  archetype: "CONSUMER_ALIGNED",
  tier: "GOLD",
  scopeBoundary: "Covers active outage dispatch; excludes billing.",
  valueHypothesis: "Unblocks the dispatch supervisor's crew-priority decision.",
  successMeasures: [{ measure: "Mean time to dispatch", target: "< 10 min" }],
};

describe("draftArtifact", () => {
  it("throws AssistUnavailableError when no client is configured", async () => {
    await expect(draftArtifact("CHARTER", context, null)).rejects.toBeInstanceOf(
      AssistUnavailableError,
    );
  });

  it("returns the parsed body when the model produces a valid draft", async () => {
    const client = fakeClient(validCharter);
    const draft = (await draftArtifact("CHARTER", context, client)) as typeof validCharter;
    expect(draft.valueHypothesis).toContain("crew-priority");
    expect(draft.successMeasures).toHaveLength(1);
  });

  it("rejects a draft that fails the artifact schema, with a typed error", async () => {
    // Missing archetype, tier, scopeBoundary, valueHypothesis, successMeasures.
    const client = fakeClient({ productName: "Half a charter" });
    await expect(draftArtifact("CHARTER", context, client)).rejects.toBeInstanceOf(
      AssistDraftError,
    );
  });

  it("passes a JSON schema and a forced tool name to the client", async () => {
    const seen: DraftRequest[] = [];
    const generate = vi.fn(async (req: DraftRequest) => {
      seen.push(req);
      return validCharter;
    });
    await draftArtifact("CHARTER", context, { generate });
    const req = seen[0]!;
    expect(req.toolName).toBe("draft_charter");
    expect(req.schema).toMatchObject({ type: "object" });
    expect(req.schema.properties).toBeDefined();
    // The consumption-first rule reaches the model.
    expect(req.system.toLowerCase()).toContain("consumption");
  });

  it("grounds the prompt in upstream context when provided", async () => {
    const seen: DraftRequest[] = [];
    const generate = vi.fn(async (req: DraftRequest) => {
      seen.push(req);
      return validCharter;
    });
    await draftArtifact(
      "CHARTER",
      { ...context, groundingNotes: "Dispatcher cannot pick which crew to send first." },
      { generate },
    );
    expect(seen[0]!.user).toContain("which crew to send first");
  });

  it("can derive a valid tool schema for every registered artifact kind", async () => {
    for (const kind of ArtifactKind.options) {
      if (!hasArtifactSchema(kind)) continue;
      const seen: DraftRequest[] = [];
      const generate = vi.fn(async (req: DraftRequest) => {
        seen.push(req);
        return {};
      });
      // We only care that schema derivation and the request build succeed; the
      // empty payload will fail validation, which is fine here.
      await draftArtifact(kind, context, { generate }).catch(() => undefined);
      expect(generate).toHaveBeenCalledOnce();
      expect(seen[0]!.schema.type).toBe("object");
    }
  });
});
