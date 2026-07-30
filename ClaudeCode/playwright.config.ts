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
  // The gate flow signs several reviewers in and out across two stages.
  timeout: 120_000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
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
