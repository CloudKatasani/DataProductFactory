import { describe, expect, it } from "vitest";
import yaml from "js-yaml";
import {
  EXPORT_FORMATS,
  exportArtifactVersion,
  isExportFormat,
} from "@/lib/exports";
import { canonicalize } from "@/lib/artifacts/hash";

/** Build a contentJson exactly as commitArtifact stores it. */
function stored(body: unknown): string {
  return canonicalize(body);
}

describe("export format guard", () => {
  it("accepts yaml and json", () => {
    expect(EXPORT_FORMATS).toEqual(["yaml", "json"]);
    expect(isExportFormat("yaml")).toBe(true);
    expect(isExportFormat("json")).toBe(true);
  });

  it("rejects anything else, including null", () => {
    expect(isExportFormat("docx")).toBe(false);
    expect(isExportFormat(null)).toBe(false);
  });
});

describe("exportArtifactVersion", () => {
  const body = {
    decisions: [
      { persona: "Dispatcher", decision: "Which crew", cadence: "15m", consequence: "Outage" },
    ],
    personas: [],
    questions: [],
    currentStatePain: "",
  };

  it("names the file from the slug and version and sets a text content type", () => {
    const json = exportArtifactVersion(
      { slug: "decision-register", versionNumber: 3, contentJson: stored(body) },
      "json",
    );
    expect(json.filename).toBe("decision-register.v3.json");
    expect(json.contentType).toContain("application/json");

    const y = exportArtifactVersion(
      { slug: "decision-register", versionNumber: 3, contentJson: stored(body) },
      "yaml",
    );
    expect(y.filename).toBe("decision-register.v3.yaml");
    expect(y.contentType).toContain("yaml");
  });

  it("round-trips the exact committed body (JSON)", () => {
    const file = exportArtifactVersion(
      { slug: "decision-register", versionNumber: 1, contentJson: stored(body) },
      "json",
    );
    expect(JSON.parse(file.body)).toEqual(body);
  });

  it("round-trips the exact committed body (YAML)", () => {
    const file = exportArtifactVersion(
      { slug: "decision-register", versionNumber: 1, contentJson: stored(body) },
      "yaml",
    );
    expect(yaml.load(file.body)).toEqual(body);
  });

  it("renders a markdown-bodied artifact as a readable block scalar", () => {
    const markdown = "# Charter\n\nLine one.\nLine two.\n";
    const file = exportArtifactVersion(
      { slug: "charter", versionNumber: 2, contentJson: stored(markdown) },
      "yaml",
    );
    // The stored body is the markdown string; YAML must preserve it exactly.
    expect(yaml.load(file.body)).toBe(markdown);
  });
});
