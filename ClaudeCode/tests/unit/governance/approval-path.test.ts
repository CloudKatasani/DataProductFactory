import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * CLAUDE.md non-negotiable 2: "There is exactly one code path that can set a
 * Gate.status to APPROVED ... covered by a test that fails if any other path can
 * reach that state."
 *
 * This is that test. It enforces two structural facts about the source tree:
 *
 *   1. Only src/lib/governance/gates.ts mutates a Gate row at all. Everything
 *      else routes through setGateStatus or approveGate.
 *   2. Within that file, "APPROVED" is written to a gate exactly once.
 *
 * Checking gate *mutation* rather than the string "APPROVED" matters: reading
 * `where: { status: "APPROVED" }` is legitimate and happens in cascade.ts, while
 * a stray `gate.update` anywhere else is the actual danger.
 *
 * If this fails on a change you believe is correct, route the change through
 * approveGate — do not widen the exception.
 */

const SRC = resolve(import.meta.dirname, "../../../src");
const SANCTIONED_FILE = "lib/governance/gates.ts";

async function sourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await sourceFiles(full)));
    } else if ([".ts", ".tsx"].includes(extname(entry.name))) {
      files.push(full);
    }
  }
  return files;
}

/** Any Prisma write against the gate model, however the client is named. */
const GATE_MUTATION = /\.gate\.(update|updateMany|upsert|create|createMany|delete|deleteMany)\s*\(/g;

/** A write of APPROVED into a field assignment, as opposed to a query filter. */
const APPROVED_ASSIGNMENT = /status\s*:\s*["'`]APPROVED["'`]/g;

/** Raw SQL would bypass every guard above. */
const RAW_SQL = /\$executeRaw|\$queryRaw|\$executeRawUnsafe|\$queryRawUnsafe/g;

function toPosix(path: string): string {
  return path.split("\\").join("/");
}

describe("the approval choke point", () => {
  it("mutates Gate rows from exactly one file", async () => {
    const offenders: Array<{ file: string; occurrences: number }> = [];

    for (const file of await sourceFiles(SRC)) {
      const matches = (await readFile(file, "utf8")).match(GATE_MUTATION);
      if (!matches) continue;

      const rel = toPosix(relative(SRC, file));
      if (rel !== SANCTIONED_FILE) {
        offenders.push({ file: rel, occurrences: matches.length });
      }
    }

    expect(
      offenders,
      `Only ${SANCTIONED_FILE} may mutate a Gate. Offending files: ` +
        offenders.map((o) => `${o.file} (${o.occurrences})`).join(", "),
    ).toEqual([]);
  });

  it("writes APPROVED to a gate exactly once, inside the sanctioned file", async () => {
    const contents = await readFile(join(SRC, SANCTIONED_FILE), "utf8");
    expect(contents.match(APPROVED_ASSIGNMENT) ?? []).toHaveLength(1);
  });

  it("uses no raw SQL anywhere, which would bypass the choke point", async () => {
    const offenders: string[] = [];
    for (const file of await sourceFiles(SRC)) {
      if ((await readFile(file, "utf8")).match(RAW_SQL)) {
        offenders.push(toPosix(relative(SRC, file)));
      }
    }
    expect(offenders).toEqual([]);
  });

  it("refuses APPROVED through the ordinary transition function", async () => {
    const { setGateStatus } = await import("@/lib/governance/gates");
    const tx = {
      gate: {
        update: () => {
          throw new Error("setGateStatus must reject APPROVED before touching the database");
        },
      },
    };

    await expect(
      setGateStatus(tx as never, {
        gateId: "g1",
        // Cast mirrors what a value arriving from JSON would do at runtime.
        to: "APPROVED" as never,
        actorId: "u1",
        workspaceId: "w1",
        productId: "p1",
      }),
    ).rejects.toThrow(/cannot approve a gate/i);
  });
});
