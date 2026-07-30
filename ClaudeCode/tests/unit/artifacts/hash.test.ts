import { describe, expect, it } from "vitest";
import { canonicalize, contentHash } from "@/lib/artifacts/hash";

describe("canonical hashing", () => {
  it("ignores key order", () => {
    const a = { name: "contract", version: 2, owner: { team: "grid", lead: "sam" } };
    const b = { owner: { lead: "sam", team: "grid" }, version: 2, name: "contract" };
    expect(contentHash(a)).toBe(contentHash(b));
  });

  it("preserves array order", () => {
    expect(contentHash({ steps: ["a", "b"] })).not.toBe(contentHash({ steps: ["b", "a"] }));
  });

  it("treats an undefined property as absent", () => {
    expect(canonicalize({ a: 1, b: undefined })).toBe(canonicalize({ a: 1 }));
  });

  it("detects a real content change", () => {
    expect(contentHash({ threshold: 0.95 })).not.toBe(contentHash({ threshold: 0.96 }));
  });

  it("produces a 64-character lowercase hex digest", () => {
    expect(contentHash({ any: "value" })).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is stable across calls", () => {
    const body = { nested: { list: [1, 2, { z: 1, a: 2 }] } };
    expect(contentHash(body)).toBe(contentHash(body));
  });
});
