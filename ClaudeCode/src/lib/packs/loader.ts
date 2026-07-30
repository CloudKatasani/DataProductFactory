import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import yaml from "js-yaml";
import { Pack } from "./schema";

export function packsRoot(): string {
  return resolve(process.cwd(), "packs");
}

export interface PackLoadFailure {
  packId: string;
  problems: string[];
}

export class PackValidationError extends Error {
  constructor(readonly failures: PackLoadFailure[]) {
    super(
      `${failures.length} pack(s) failed validation:\n` +
        failures
          .map((f) => `  ${f.packId}\n${f.problems.map((p) => `    - ${p}`).join("\n")}`)
          .join("\n"),
    );
    this.name = "PackValidationError";
  }
}

/** Directory names under packs/, excluding dotfiles. */
export async function listPackIds(): Promise<string[]> {
  const entries = await readdir(packsRoot(), { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .map((e) => e.name)
    .sort();
}

/** Loads and validates one pack. Throws PackValidationError on any problem. */
export async function loadPack(packId: string): Promise<Pack> {
  const file = join(packsRoot(), packId, "pack.yaml");
  let raw: unknown;
  try {
    raw = yaml.load(await readFile(file, "utf8"));
  } catch (cause) {
    throw new PackValidationError([
      { packId, problems: [`could not read or parse ${file}: ${(cause as Error).message}`] },
    ]);
  }

  const parsed = Pack.safeParse(raw);
  if (!parsed.success) {
    throw new PackValidationError([
      {
        packId,
        problems: parsed.error.issues.map(
          (i) => `${i.path.join(".") || "(root)"}: ${i.message}`,
        ),
      },
    ]);
  }

  if (parsed.data.id !== packId) {
    throw new PackValidationError([
      {
        packId,
        problems: [`pack.yaml declares id "${parsed.data.id}" but lives in packs/${packId}/`],
      },
    ]);
  }

  return parsed.data;
}

/** Loads every pack, collecting all failures rather than stopping at the first. */
export async function loadAllPacks(): Promise<Pack[]> {
  const ids = await listPackIds();
  const packs: Pack[] = [];
  const failures: PackLoadFailure[] = [];

  for (const id of ids) {
    try {
      packs.push(await loadPack(id));
    } catch (error) {
      if (error instanceof PackValidationError) {
        failures.push(...error.failures);
      } else {
        failures.push({ packId: id, problems: [(error as Error).message] });
      }
    }
  }

  if (failures.length > 0) {
    throw new PackValidationError(failures);
  }
  return packs;
}
