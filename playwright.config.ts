import { defineConfig, devices } from "@playwright/test";

import { BASE_URL as baseURL, LIVE, PORT, SERVER } from "./e2e/server";

export default defineConfig({
  testDir: "./e2e",
  // Live mode only (CI): loads the seed into the runner's local database and
  // makes the sample Staff password Users on its local Supabase.
  globalSetup: LIVE ? "./e2e/admin/global-setup.ts" : undefined,
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    // Starts the run from the seed and the sample staff list.
    { name: "sample data", testMatch: "sample-data.setup.ts" },
    // The Website specs.
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: "admin/**",
      dependencies: ["sample data"],
    },
    // The Admin specs change the shared sample data, so they run after the
    // Website specs, one at a time (CONVENTIONS §6).
    {
      name: "admin",
      testDir: "./e2e/admin",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["chromium"],
      workers: 1,
    },
  ],
  webServer: {
    command: "pnpm dev",
    // Ready once it serves a route that reads no data: on a fresh local
    // database the pages fail until the setup step has loaded the seed.
    url: `${baseURL}/robots.txt`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      PORT: String(PORT),
      // The site URL follows the port, so canonical URLs, the sitemap and the
      // JSON-LD point at the server under test on any PLAYWRIGHT_PORT.
      NEXT_PUBLIC_SITE_URL: `${baseURL}/`,
      // The database, Supabase and secret key: blank by default, so the Admin
      // runs on the in-memory sample data whatever .env says (Next never
      // replaces a variable that is set), or the local Supabase the PLAYWRIGHT_*
      // values name (CI). Never the hosted project. See e2e/server.ts.
      ...SERVER.env,
    },
  },
});
