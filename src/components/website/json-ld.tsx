import { headers } from "next/headers";

import { serializeJsonLd } from "@/lib/catalogue/json-ld";

/** Structured data for search engines, carrying the request's CSP nonce. */
export async function JsonLd({ data }: { data: Record<string, unknown> }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      // Browsers hide a nonce from the DOM once the page loads, so hydration
      // always sees nonce="" here. That mismatch is expected and harmless.
      suppressHydrationWarning
      // Escaped by serializeJsonLd, so the content can't break out of the tag.
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
