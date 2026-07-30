import yaml from "js-yaml";

/**
 * Export adapters. Per CLAUDE.md section 4, every export library is imported
 * only inside src/lib/exports/ — nothing outside this directory may import
 * js-yaml (for export), docx, exceljs or the PDF printer. Callers take an
 * {@link ExportFile} and stream it; they never touch a serializer.
 *
 * YAML and JSON are implemented now. docx / xlsx / pdf get their own adapter
 * files here as their stages come online.
 */

export const EXPORT_FORMATS = ["yaml", "json"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export function isExportFormat(value: string | null): value is ExportFormat {
  return value !== null && (EXPORT_FORMATS as readonly string[]).includes(value);
}

export interface ExportFile {
  filename: string;
  contentType: string;
  body: string;
}

/** The committed artifact version to export, as stored on ArtifactVersion. */
export interface ArtifactVersionExportInput {
  /** File/identity stem, e.g. "decision-register". */
  slug: string;
  versionNumber: number;
  /** Canonical JSON of the artifact body (ArtifactVersion.contentJson). */
  contentJson: string;
}

const CONTENT_TYPE: Record<ExportFormat, string> = {
  // Charset is explicit so a browser renders the download as UTF-8 text.
  yaml: "application/x-yaml; charset=utf-8",
  json: "application/json; charset=utf-8",
};

const EXTENSION: Record<ExportFormat, string> = {
  yaml: "yaml",
  json: "json",
};

function serialize(format: ExportFormat, body: unknown): string {
  switch (format) {
    case "yaml":
      // Sorted keys + block scalars for multiline strings (e.g. a rendered
      // charter) keep the output stable and diff-friendly.
      return yaml.dump(body, { sortKeys: true, lineWidth: 100, noRefs: true });
    case "json":
      return `${JSON.stringify(body, null, 2)}\n`;
  }
}

/**
 * Serialize one committed artifact version to a downloadable file. The body is
 * the exact content that was hashed and approved, re-serialized into the
 * requested format — never regenerated, so an export always matches the
 * version's hash.
 */
export function exportArtifactVersion(
  input: ArtifactVersionExportInput,
  format: ExportFormat,
): ExportFile {
  const body: unknown = JSON.parse(input.contentJson);
  return {
    filename: `${input.slug}.v${input.versionNumber}.${EXTENSION[format]}`,
    contentType: CONTENT_TYPE[format],
    body: serialize(format, body),
  };
}
