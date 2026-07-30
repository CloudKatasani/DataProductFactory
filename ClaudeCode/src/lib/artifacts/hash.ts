import { createHash } from "node:crypto";

/**
 * Canonical JSON: object keys sorted at every depth, no incidental whitespace.
 * Two artifact bodies that differ only in key order must hash identically —
 * otherwise a cosmetic reserialization would look like a content change and
 * would cascade-invalidate every downstream approval for nothing.
 */
export function canonicalize(value: unknown): string {
  return JSON.stringify(sortDeep(value));
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    // Array order is meaningful — preserve it, canonicalize the elements.
    return value.map(sortDeep);
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      // Drop undefined so `{a: undefined}` and `{}` agree, matching JSON.stringify.
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return Object.fromEntries(entries.map(([k, v]) => [k, sortDeep(v)]));
  }
  return value;
}

/** SHA-256 of the canonical JSON, lowercase hex. This is the version identity. */
export function contentHash(value: unknown): string {
  return createHash("sha256").update(canonicalize(value), "utf8").digest("hex");
}
