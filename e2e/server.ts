import { e2eServerEnv } from "../src/lib/e2e-server-env";

// The server under test, shared by playwright.config.ts and the specs' helpers
// (ticket 16). By default it runs on the in-memory sample data, with none of
// .env's hosted values. With the PLAYWRIGHT_* values for a local Supabase
// (CI), it runs live on that one: see src/lib/e2e-server-env.ts.

export const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3000);
export const BASE_URL = `http://localhost:${PORT}`;

export const SERVER = e2eServerEnv(process.env);

/** Whether the Admin runs live, with Supabase sign-in, on the server under test. */
export const LIVE = SERVER.mode === "live";
