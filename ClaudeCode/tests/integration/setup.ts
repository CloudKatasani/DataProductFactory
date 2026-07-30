import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Per-worker setup, run before any test module is imported. It sets the two env
 * vars the server code reads at import time:
 *
 *   DATABASE_URL       — the throwaway test.db that global-setup created.
 *   DPF_WORKSPACE_ROOT — a fresh temp dir, so artifact mirror writes never touch
 *                        the repository's workspace/ tree.
 *
 * Must run before @/lib/db/client (the Prisma singleton reads DATABASE_URL in
 * its constructor) — setupFiles are guaranteed to execute before test imports.
 */
process.env.DATABASE_URL = `file:${join(process.cwd(), "prisma", "test.db")}`;
process.env.DPF_WORKSPACE_ROOT = mkdtempSync(join(tmpdir(), "dpf-mirror-"));
