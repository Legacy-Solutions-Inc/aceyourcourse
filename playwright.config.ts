import { defineConfig, devices } from "@playwright/test";

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
    // The Website specs.
    { name: "chromium", use: { ...devices["Desktop Chrome"] }, testIgnore: "admin/**" },
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
    url: baseURL,
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
    },
  },
});
