import { defineConfig, devices } from "@playwright/test";

import { LOCAL_DATABASE_URL } from "./src/lib/db/local-database";

const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3000);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
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
      NEXT_PUBLIC_SUPABASE_URL:
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "placeholder",
      // The local database, whatever .env says (Next never overrides a
      // variable that is set): the Website and the Admin read and write it,
      // and the reset route re-seeds it. PLAYWRIGHT_DATABASE_URL points the run
      // at another local database, such as one on another port.
      DATABASE_URL: process.env.PLAYWRIGHT_DATABASE_URL ?? LOCAL_DATABASE_URL,
    },
  },
});
