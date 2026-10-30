import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { paths } from "@/paths";

const codeSchema = z.string().min(1);

/**
 * A same-origin path: a single leading "/". "//host" and "/\host" are
 * protocol-relative to a browser, so they would leave the site.
 */
const nextSchema = z.string().regex(/^\/(?![/\\])/);

// Exchanges the OAuth PKCE `code` for a session, then redirects to a safe `next`
// path. Without a code, or when the exchange fails, the User lands on Home.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = codeSchema.safeParse(searchParams.get("code"));

  if (code.success) {
    const supabase = createClient(cookies());
    const { error } = await supabase.auth.exchangeCodeForSession(code.data);
    if (!error) {
      const next = nextSchema.safeParse(searchParams.get("next"));
      return NextResponse.redirect(`${origin}${next.success ? next.data : paths.home}`);
    }
  }

  return NextResponse.redirect(`${origin}${paths.home}`);
}
