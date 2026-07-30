import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import { join } from "node:path";

/**
 * Prepares a hermetic database for the e2e run: a dedicated e2e.db, reset and
 * seeded from scratch, so the browser flow starts from the known demo state and
 * never touches the developer's dev.db. The dev server (see playwright.config)
 * is pointed at this same database.
 */
export const E2E_DB = "file:./e2e.db";

export default function globalSetup(): void {
  const abs = join(process.cwd(), "prisma", "e2e.db");
  for (const suffix of ["", "-journal"]) {
    rmSync(`${abs}${suffix}`, { force: true });
  }
  const env = { ...process.env, DATABASE_URL: E2E_DB };
  execSync("npx --no-install prisma db push --skip-generate", { env, stdio: "inherit" });
  execSync("npx --no-install tsx prisma/seed.ts", { env, stdio: "inherit" });
}
