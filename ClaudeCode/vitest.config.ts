import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Vite otherwise picks up postcss.config.mjs and tries to load the Tailwind v4
  // plugin, which it cannot use. No test here imports CSS, so skip it entirely.
  css: { postcss: { plugins: [] } },
  test: {
    // Node, not jsdom: everything under test here is server-side governance
    // logic. Component tests opt into jsdom per-file with a docblock.
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    // Playwright owns tests/e2e — vitest must not try to run it.
    exclude: ["tests/e2e/**", "node_modules/**"],
    // Creates the throwaway test.db once from the live schema.
    globalSetup: ["tests/integration/global-setup.ts"],
    // Points DATABASE_URL / DPF_WORKSPACE_ROOT at throwaway locations before any
    // server module (and the Prisma singleton) is imported.
    setupFiles: ["tests/integration/setup.ts"],
  },
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "src"),
    },
  },
});
