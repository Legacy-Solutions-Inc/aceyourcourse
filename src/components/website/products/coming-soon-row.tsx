import { ProductCard } from "@/components/website/product-card";
import { productsPageCopy } from "@/content/products-page";
import type { Product } from "@/services/catalogue.types";

const copy = productsPageCopy.comingSoon;

/**
 * The Coming Soon Products that match the Exam, format and search filters, in
 * their own row: each card has its badge and no price. Hidden when none match.
 */
export function ComingSoonRow({
  products,
  memberAppLive,
}: {
  products: Product[];
  memberAppLive: boolean;
}) {
  if (products.length === 0) return null;
  return (
    <section
      aria-labelledby="coming-soon-heading"
      className="border-t-[1.5px] border-ayc-navy bg-ayc-sand"
    >
      <div className="mx-auto flex max-w-324 flex-col gap-7 px-[clamp(20px,5vw,72px)] py-[clamp(48px,6vw,88px)]">
        <div className="flex flex-col gap-2.5">
          <h2
            id="coming-soon-heading"
            className="text-[clamp(30px,3.6vw,46px)] leading-none font-extrabold tracking-[-0.03em]"
          >
            {copy.heading}
          </h2>
          <p className="max-w-[36em] text-[17px] leading-normal text-ayc-slate">{copy.intro}</p>
        </div>
        <ul
          aria-labelledby="coming-soon-heading"
          className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] gap-x-7 gap-y-8"
        >
          {products.map((product) => (
            <li key={product.id} className="flex">
              <ProductCard product={product} memberAppLive={memberAppLive} className="w-full" />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
