import { describe, expect, it } from "vitest";
import { listPackIds, loadAllPacks, loadPack } from "@/lib/packs/loader";
import { Pack } from "@/lib/packs/schema";

describe("pack loading", () => {
  it("finds the generic baseline pack", async () => {
    expect(await listPackIds()).toContain("_generic");
  });

  it("validates every pack in the repository", async () => {
    const packs = await loadAllPacks();
    expect(packs.length).toBeGreaterThan(0);
    for (const pack of packs) {
      expect(Pack.safeParse(pack).success, `pack ${pack.id}`).toBe(true);
    }
  });

  it("loads _generic with its conformed backbone", async () => {
    const pack = await loadPack("_generic");
    expect(pack.id).toBe("_generic");
    expect(pack.conformedBackbone.map((e) => e.id)).toContain("party");
  });

  it("loads the utility pack with its regulatory floor and reliability metrics", async () => {
    const pack = await loadPack("utility");
    expect(pack.id).toBe("utility");
    expect(pack.conformedBackbone.map((e) => e.id)).toContain("outage-event");

    // NERC CIP sets a classification floor no lower than CONFIDENTIAL.
    const nerc = pack.regulatoryConstraints.find((c) => c.id === "nerc-cip");
    expect(nerc?.minimumSensitivity).toBe("CONFIDENTIAL");

    expect(pack.starterMetrics.map((m) => m.name)).toEqual(
      expect.arrayContaining(["SAIDI", "SAIFI"]),
    );
  });

  it("reports a missing pack rather than returning undefined", async () => {
    await expect(loadPack("does-not-exist")).rejects.toThrow(/could not read or parse/);
  });
});

describe("pack schema", () => {
  it("rejects a non-semver version", () => {
    const result = Pack.safeParse({ id: "x", name: "X", version: "1.0" });
    expect(result.success).toBe(false);
  });

  it("rejects an id that is not lower-kebab-case", () => {
    const result = Pack.safeParse({ id: "Utility Pack", name: "X", version: "1.0.0" });
    expect(result.success).toBe(false);
  });

  it("defaults every collection to empty so a minimal pack is valid", () => {
    const result = Pack.parse({ id: "minimal", name: "Minimal", version: "0.1.0" });
    expect(result.domains).toEqual([]);
    expect(result.regulatoryConstraints).toEqual([]);
  });
});
