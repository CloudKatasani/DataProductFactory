import { defineConfig, devices } from "@playwright/test";

/**
 * The e2e run is hermetic: globalSetup resets and seeds a dedicated e2e.db, and
 * the dev server below is pinned to that same database, a fixed AUTH_SECRET, and
 * a throwaway mirror root so artifact commits never write into the Git-tracked
 * workspace/ tree. Real env vars win over .env in Next, so these override the
 * developer's local .env for the spawned server.
 */
const E2E_ENV = {
  DATABASE_URL: "file:./e2e.db",
  AUTH_SECRET: "e2e-fixed-secret-not-a-real-secret-0000000000",
  AUTH_TRUST_HOST: "true",
  DPF_WORKSPACE_ROOT: "e2e-workspace",
};

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  // The consumption-first spec is a long mega-flow: it signs several reviewers
  // in and out and drives stages 1 through 5, so `next dev` lazily compiles ~10
  // routes within one test. On a loaded machine that cold-compile can stack up
  // well past two minutes; give it generous headroom so it completes on the
  // first attempt rather than timing out mid-flow and leaving shared state dirty
  // for the retry. A genuine break still fails fast on an assertion.
  timeout: 240_000,
  // next dev compiles routes lazily on first hit; deep in the multi-stage flow
  // those compilations can stack up, so give assertions generous room over the
  // 5s default. Assertions still resolve as soon as the condition is met, so
  // this only affects the cold-compile case, not passing-test speed.
  expect: { timeout: 30_000 },
  forbidOnly: !!process.env.CI,
  // One retry even locally: next dev compiles routes lazily on first hit, and the
  // long multi-stage flow occasionally trips that cold-start latency. The retry
  // runs against an already-warm server, so it absorbs the environmental flake
  // without masking real failures (a genuine break fails both attempts).
  retries: process.env.CI ? 2 : 1,
  reporter: process.env.CI ? "github" : "list",
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Portable: honour a preinstalled Chromium when PLAYWRIGHT_CHROMIUM_PATH
        // is set (e.g. CI images that ship a browser), else Playwright's default.
        launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
          ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
          : {},
      },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { ...process.env, ...E2E_ENV },
  },
});
