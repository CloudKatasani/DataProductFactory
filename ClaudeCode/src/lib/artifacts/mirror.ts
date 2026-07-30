import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import yaml from "js-yaml";

/**
 * Non-negotiable 7. Every version commit writes the artifact to
 * workspace/<workspace-slug>/<product-slug>/ so the whole estate is
 * Git-diffable. The database holds state and history; these files hold the truth
 * you can review in a pull request.
 */

export type MirrorFormat = "yaml" | "json" | "markdown";

export interface MirrorInput {
  workspaceSlug: string;
  productSlug: string;
  /** File stem, e.g. "data-contract". Extension comes from `format`. */
  slug: string;
  format: MirrorFormat;
  body: unknown;
}

const EXTENSION: Record<MirrorFormat, string> = {
  yaml: "yml",
  json: "json",
  markdown: "md",
};

export function workspaceRoot(): string {
  return resolve(process.cwd(), process.env.DPF_WORKSPACE_ROOT ?? "workspace");
}

/** Path relative to the workspace root, as stored on ArtifactVersion.mirrorPath. */
export function mirrorPathFor(input: Omit<MirrorInput, "body">): string {
  return join(
    input.workspaceSlug,
    input.productSlug,
    `${input.slug}.${EXTENSION[input.format]}`,
  );
}

function serialize(format: MirrorFormat, body: unknown): string {
  switch (format) {
    case "yaml":
      return yaml.dump(body, { sortKeys: true, lineWidth: 100, noRefs: true });
    case "json":
      return `${JSON.stringify(body, null, 2)}\n`;
    case "markdown":
      if (typeof body !== "string") {
        throw new Error(
          "Markdown artifacts must serialize to a string body before mirroring.",
        );
      }
      return body.endsWith("\n") ? body : `${body}\n`;
  }
}

/** Writes the mirror file and returns its workspace-relative path. */
export async function mirrorArtifact(input: MirrorInput): Promise<string> {
  const relative = mirrorPathFor(input);
  const absolute = join(workspaceRoot(), relative);
  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, serialize(input.format, input.body), "utf8");
  return relative;
}
