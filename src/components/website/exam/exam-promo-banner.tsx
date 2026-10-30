import Link from "next/link";

import { examPageCopy, type ExamPromo } from "@/content/exam-pages";
import { paths } from "@/paths";

interface ExamPromoBannerProps {
  promo: Pick<ExamPromo, "eyebrow" | "body">;
  productSlug: string;
  /** The Product's price, read from the catalogue, e.g. "₱3,499". */
  price: string;
  /** What the bundle saves over its parts, e.g. "₱200", or null for none. */
  saving: string | null;
}

/** An offer of one Live Product on its Exam page, linking to the Product page. */
export function ExamPromoBanner({ promo, productSlug, price, saving }: ExamPromoBannerProps) {
  const eyebrow = examPageCopy.promo.withSaving(promo.eyebrow, saving);
  return (
    <section
      aria-label={eyebrow}
      className="mx-auto max-w-324 px-[clamp(20px,5vw,72px)] pt-[clamp(56px,7vw,96px)]"
    >
      <Link
        href={paths.products.details(productSlug)}
        className="flex flex-wrap items-center gap-x-12 gap-y-6 border-[1.5px] border-ayc-navy bg-ayc-navy p-[clamp(22px,3vw,40px)] text-ayc-cream no-underline shadow-hard-lg shadow-ayc-orange transition-transform hover:-translate-x-0.75 hover:-translate-y-0.75 hover:text-ayc-cream motion-reduce:transition-none"
      >
        <span className="flex flex-[1_1_320px] flex-col gap-3">
          <span className="font-mono text-xs font-bold tracking-[0.08em] text-ayc-orange uppercase">
            {eyebrow}
          </span>
          <span className="text-[clamp(26px,3.2vw,42px)] leading-[1.05] font-extrabold tracking-[-0.03em] text-balance">
            {promo.body}
          </span>
        </span>
        <span className="flex flex-col items-start gap-2">
          <span className="text-[clamp(36px,4vw,52px)] leading-none font-black tracking-[-0.03em]">
            {price}
          </span>
          <span className="border-b-2 border-ayc-orange text-base font-bold">
            {examPageCopy.promo.seeBundle} <span aria-hidden="true">→</span>
          </span>
        </span>
      </Link>
    </section>
  );
}
