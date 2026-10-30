import { MarketplaceLink } from "@/components/website/marketplace-link";
import { faqPageCopy } from "@/content/faq-page";
import { cn } from "@/lib/utils";

const copy = faqPageCopy;
const container = "mx-auto max-w-324 px-[clamp(20px,5vw,72px)]";

/** The FAQ page's closing band: email, and Shopee chat when there's a Shopee shop. */
export function StillHaveAQuestion({
  contactEmail,
  shopeeShop,
}: {
  contactEmail: string;
  /** The Shopee shop page, or null to hide "Chat us on Shopee". */
  shopeeShop: string | null;
}) {
  return (
    <section
      aria-labelledby="still-have-a-question"
      className="border-y-[1.5px] border-ayc-navy bg-ayc-blue text-ayc-cream"
    >
      <div
        className={cn(
          container,
          "flex flex-wrap items-center justify-between gap-x-10 gap-y-6 py-[clamp(48px,6vw,88px)]",
        )}
      >
        <div className="flex max-w-140 flex-col gap-2.5">
          <h2
            id="still-have-a-question"
            className="text-[clamp(32px,4vw,56px)] leading-none font-extrabold tracking-[-0.035em]"
          >
            {copy.stillHaveAQuestion}
          </h2>
          <p className="text-[17px] leading-normal">
            {copy.supportLead} {contactEmail}
            {shopeeShop ? copy.supportShopee : "."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <a
            href={`mailto:${contactEmail}`}
            className="flex min-h-14 items-center border-[1.5px] border-ayc-cream px-5.5 text-base font-bold text-ayc-cream no-underline hover:bg-ayc-cream/10 hover:text-ayc-cream focus-visible:outline-ayc-cream"
          >
            {copy.emailUs}
          </a>
          {shopeeShop ? (
            <MarketplaceLink
              href={shopeeShop}
              marketplace="shopee"
              link="shop"
              className="flex min-h-14 items-center border-[1.5px] border-ayc-navy bg-ayc-orange px-6 text-base font-extrabold text-ayc-navy no-underline shadow-hard-md transition-[translate,box-shadow] hover:-translate-0.5 hover:text-ayc-navy hover:shadow-hard-lg focus-visible:outline-ayc-cream motion-reduce:transition-none"
            >
              {copy.chatOnShopee} <span aria-hidden="true">&nbsp;↗</span>
            </MarketplaceLink>
          ) : null}
        </div>
      </div>
    </section>
  );
}
