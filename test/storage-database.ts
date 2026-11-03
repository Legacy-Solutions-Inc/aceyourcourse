import { describe } from "vitest";

import { CATALOGUE_BUCKET } from "@/lib/catalogue-bucket";
import { LOCAL_SUPABASE_URL } from "@/lib/db/local-database";
import { connectStorage, type StorageConnection } from "@/lib/supabase/admin";

/**
 * Local Supabase's Storage for the database tests (`pnpm test:db`, ticket
 * 17). It reads TEST_SUPABASE_SECRET_KEY, and TEST_SUPABASE_URL (local
 * Supabase's when unset), never the app's own SUPABASE_SECRET_KEY. Without
 * them, or when Storage doesn't answer, the tests skip with the reason; CI's
 * TEST_DATABASE_REQUIRED=true makes that a failure instead.
 */
export type TestStorage =
  { storage: StorageConnection; skipReason?: never } | { storage?: never; skipReason: string };

const HOW_TO_RUN =
  "Run `pnpm db:start`, then set TEST_SUPABASE_SECRET_KEY to local Supabase's secret key " +
  "(`supabase status`; README → Local database).";

async function connect(): Promise<TestStorage> {
  const key = process.env.TEST_SUPABASE_SECRET_KEY;
  if (!key) return { skipReason: `TEST_SUPABASE_SECRET_KEY is not set. ${HOW_TO_RUN}` };
  const storage = connectStorage(process.env.TEST_SUPABASE_URL ?? LOCAL_SUPABASE_URL, key);
  try {
    const { error } = await storage.client.storage.getBucket(CATALOGUE_BUCKET);
    // Only the error's name: its message may echo the URL.
    if (error)
      return { skipReason: `Storage has no catalogue bucket (${error.name}). ${HOW_TO_RUN}` };
    return { storage };
  } catch {
    return { skipReason: `TEST_SUPABASE_URL is unreachable. ${HOW_TO_RUN}` };
  }
}

export async function openTestStorage(): Promise<TestStorage> {
  const opened = await connect();
  if (opened.skipReason && process.env.TEST_DATABASE_REQUIRED === "true") {
    throw new Error(`The Storage tests need local Supabase: ${opened.skipReason}`);
  }
  return opened;
}

/** A suite that needs Storage, and maybe more. Without them it's skipped, saying why. */
export function describeWithStorage(
  name: string,
  needs: { skipReason?: string }[],
  body: () => void,
) {
  const skipReason = needs.find((need) => need.skipReason)?.skipReason;
  if (skipReason) console.warn(`[database tests] ${name}: skipped. ${skipReason}`);
  describe.skipIf(Boolean(skipReason))(
    skipReason ? `${name} (skipped: ${skipReason})` : name,
    body,
  );
}

/** PUTs a file to an upload URL as the browser's photo strip does (put-file.ts). */
export function putFile(uploadUrl: string, contentType: string, bytes: Uint8Array) {
  return fetch(uploadUrl, { method: "PUT", headers: { "content-type": contentType }, body: bytes });
}

/** The file at a public URL, or null when there's none. */
export async function readPublicFile(
  publicUrl: string,
): Promise<{ contentType: string | null; bytes: Uint8Array } | null> {
  const response = await fetch(publicUrl, { cache: "no-store" });
  if (!response.ok) return null;
  return {
    contentType: response.headers.get("content-type"),
    bytes: new Uint8Array(await response.arrayBuffer()),
  };
}
