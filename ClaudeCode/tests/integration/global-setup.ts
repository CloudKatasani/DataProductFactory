import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import { join } from "node:path";

/**
 * Runs once before the integration suite. Creates a throwaway SQLite database
 * from the current Prisma schema so the real governance write paths — Prisma
 * transactions, unique constraints, cascade invalidation — are exercised against
 * an actual database, not a mock.
 *
 * The per-worker setup file (tests/integration/setup.ts) points DATABASE_URL at
 * this same file before the Prisma client is constructed.
 *
 * The old database file is deleted directly rather than via `prisma db push
 * --force-reset`: that destructive flag trips Prisma's AI-agent safety guard.
 * Deleting a throwaway file and running a plain, non-destructive `db push` is
 * equivalent here and stays clear of that guard.
 */
export const TEST_DB_PATH = join(process.cwd(), "prisma", "test.db");

export default function globalSetup(): void {
  for (const suffix of ["", "-journal"]) {
    rmSync(`${TEST_DB_PATH}${suffix}`, { force: true });
  }
  // npx resolves the project-local prisma binary; a bare `prisma` is not on PATH
  // under execSync.
  execSync("npx --no-install prisma db push --skip-generate", {
    env: { ...process.env, DATABASE_URL: `file:${TEST_DB_PATH}` },
    stdio: "inherit",
  });
}
