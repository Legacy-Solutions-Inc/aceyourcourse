import { getSiteURL } from "@/lib/get-site-url";
import { buildLlmsTxt } from "@/lib/llms-txt";
import { getWebsiteSettings, listExams, listFaqs, listProducts } from "@/services/catalogue";

// GET /llms.txt: the Website's summary for AI assistants (ticket 22; spec,
// Phase 2 → Summary for AI assistants). Built on every request like the
// sitemap, from the Catalogue seam's cached reads, which an Admin save
// clears, so it always says what the Website does.
export const dynamic = "force-dynamic";

const PLAIN_TEXT = { "content-type": "text/plain; charset=utf-8" };

export async function GET(): Promise<Response> {
  try {
    const [exams, live, comingSoon, faqs, settings] = await Promise.all([
      listExams(),
      listProducts(),
      listProducts({ state: "coming-soon" }),
      listFaqs(),
      getWebsiteSettings(),
    ]);
    const text = buildLlmsTxt(getSiteURL(), {
      exams,
      products: [...live.items, ...comingSoon.items],
      faqs,
      shopLinks: settings.shopLinks,
    });
    return new Response(text, { headers: PLAIN_TEXT });
  } catch (error) {
    console.error("Couldn't build /llms.txt from the catalogue:", error);
    return new Response("The summary isn't available right now.", {
      status: 503,
      headers: PLAIN_TEXT,
    });
  }
}
