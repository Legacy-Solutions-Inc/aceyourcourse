import Link from "next/link";
import { useId } from "react";

import { HOME_SECTION_IDS } from "@/components/website/home/section-ids";
import { SubjectChips } from "@/components/website/home/subject-chips";
import { ProductImage } from "@/components/website/product-image";
import { RatingStar } from "@/components/website/rating-star";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { homeCopy } from "@/content/home";
import { formatCount, formatRating } from "@/lib/catalogue/figures";
import { productFormatLabel } from "@/lib/catalogue/format";
import { productPriceLabel } from "@/lib/catalogue/price";
import { cn } from "@/lib/utils";
import { paths } from "@/paths";
import type { Exam, Product } from "@/services/catalogue.types";

const copy = homeCopy.findExam;

const mono = "font-mono text-[11px] font-medium tracking-[0.06em] text-ayc-slate uppercase";
const badge = "font-mono text-[10px] leading-none font-bold tracking-[0.04em] uppercase";
const panelLink =
  "flex min-h-12.5 items-center border-[1.5px] border-ayc-navy px-5 text-[15px] font-bold no-underline transition-colors motion-reduce:transition-none";

interface FindYourExamProps {
  /** Every Exam on the Website, in order. */
  exams: Exam[];
  /** Live Products by units sold, as listProducts() returns them. */
  products: Product[];
  memberAppLive: boolean;
}

/**
 * "Find your exam" (#exams): a tab per Exam with Live Products, operable with
 * the arrow keys. Each panel shows the Exam, its Subjects, a link to its Exam
 * page and its Live Products by units sold. "Review {code} in the app" shows
 * only while the Member App switch is on and one of them is in the app.
 * Renders nothing when no Exam has Live Products.
 */
export function FindYourExam({ exams, products, memberAppLive }: FindYourExamProps) {
  const headingId = useId();
  const live = products.filter((product) => product.state === "live");
  const tabs = exams.flatMap((exam) => {
    const examProducts = live.filter((product) => product.examCode === exam.code);
    return examProducts.length > 0 ? [{ exam, products: examProducts }] : [];
  });
  const [first] = tabs;
  if (!first) return null;

  return (
    <section
      id={HOME_SECTION_IDS.exams}
      aria-labelledby={headingId}
      className="mx-auto flex max-w-324 scroll-mt-24 flex-col gap-6 px-[clamp(20px,5vw,72px)] pt-[clamp(40px,5vw,72px)] pb-[clamp(64px,8vw,120px)]"
    >
      <div className="flex flex-col gap-3">
        <p className="font-mono text-xs font-bold tracking-[0.08em] text-ayc-blue uppercase">
          {copy.eyebrow}
        </p>
        <h2
          id={headingId}
          className="text-[clamp(36px,4.6vw,64px)] leading-none font-extrabold tracking-[-0.035em]"
        >
          {copy.heading}
        </h2>
      </div>
      <Tabs defaultValue={first.exam.code} className="gap-6">
        <TabsList
          aria-label={copy.examsLabel}
          className="grid w-full grid-cols-[repeat(auto-fit,minmax(min(100%,150px),1fr))] gap-2.5 rounded-none bg-transparent p-0 group-data-[orientation=horizontal]/tabs:h-auto"
        >
          {tabs.map(({ exam }) => (
            <TabsTrigger
              key={exam.code}
              value={exam.code}
              className="h-auto flex-col items-start gap-1 rounded-none border-[1.5px] border-ayc-navy bg-ayc-paper px-4 py-3.5 text-left whitespace-normal text-ayc-navy transition-[transform,box-shadow,background-color] hover:text-ayc-navy focus-visible:border-ayc-navy focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ayc-blue data-[state=active]:-translate-x-0.5 data-[state=active]:-translate-y-0.5 data-[state=active]:bg-ayc-navy data-[state=active]:text-ayc-cream data-[state=active]:shadow-[5px_5px_0_var(--ayc-orange)] motion-reduce:transition-none"
            >
              <span className="font-mono text-[clamp(22px,2.4vw,30px)] leading-none font-bold">
                {exam.code}
              </span>
              <span className="text-[13px] leading-tight font-semibold">{exam.name}</span>
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map(({ exam, products: examProducts }) => (
          <TabsContent key={exam.code} value={exam.code}>
            <ExamPanel exam={exam} products={examProducts} memberAppLive={memberAppLive} />
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
}

interface ExamPanelProps {
  exam: Exam;
  /** The Exam's Live Products by units sold. */
  products: Product[];
  memberAppLive: boolean;
}

function ExamPanel({ exam, products, memberAppLive }: ExamPanelProps) {
  const subjectsId = useId();
  const productsId = useId();
  const showAppLink = memberAppLive && products.some((product) => product.availableInApp);

  return (
    <div className="flex flex-wrap border-[1.5px] border-ayc-navy bg-ayc-paper shadow-hard-lg">
      <div className="-mr-[1.5px] flex min-w-0 flex-[1_1_340px] flex-col gap-4.5 border-r-[1.5px] border-ayc-navy p-[clamp(22px,3vw,40px)]">
        <div className="flex items-end gap-3.5">
          <span className="border-[1.5px] border-ayc-navy bg-ayc-blue px-4 pt-3.5 pb-2.5 font-mono text-[clamp(40px,5vw,64px)] leading-[0.85] font-bold text-ayc-cream">
            {exam.code}
          </span>
          <span className="flex flex-col gap-0.75 pb-1">
            <h3 className="text-[clamp(22px,2.4vw,30px)] leading-[1.05] font-extrabold tracking-[-0.02em]">
              {exam.name}
            </h3>
            <span className="font-mono text-xs font-medium text-ayc-slate uppercase">
              {exam.board} · {exam.longName}
            </span>
          </span>
        </div>
        <p className="text-base leading-relaxed text-pretty text-ayc-slate">{exam.blurb}</p>
        <div className="flex flex-col gap-2">
          <p id={subjectsId} className={mono}>
            {copy.subjects}
          </p>
          <SubjectChips subjects={exam.subjects} labelledBy={subjectsId} />
        </div>
        <div className="mt-auto flex flex-wrap gap-2.5 pt-1.5">
          <Link
            href={paths.exams.details(exam.code)}
            className={cn(
              panelLink,
              "bg-ayc-navy text-ayc-cream hover:bg-ayc-blue hover:text-ayc-cream",
            )}
          >
            {copy.allReviewers(exam.code)}&nbsp;<span aria-hidden="true">→</span>
          </Link>
          {showAppLink ? (
            <Link
              href={paths.memberApp.home}
              className={cn(panelLink, "text-ayc-navy hover:bg-ayc-sand hover:text-ayc-navy")}
            >
              {copy.reviewInApp(exam.code)}
            </Link>
          ) : null}
        </div>
      </div>
      <div className="flex min-w-0 flex-[1.2_1_360px] flex-col gap-1.5 p-[clamp(18px,2.4vw,28px)]">
        <p id={productsId} className={cn(mono, "px-1 pb-1.5")}>
          {copy.formats(products.length)}
        </p>
        <ul aria-labelledby={productsId} className="flex flex-col">
          {products.map((product) => (
            <li key={product.id}>
              <ProductRow product={product} memberAppLive={memberAppLive} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ProductRow({ product, memberAppLive }: { product: Product; memberAppLive: boolean }) {
  const figures = product.shopee;
  return (
    <article className="relative grid grid-cols-[64px_minmax(0,1fr)] items-center gap-x-3.5 gap-y-1.5 border-[1.5px] border-transparent p-2.5 transition-colors hover:border-ayc-navy hover:bg-ayc-cream motion-reduce:transition-none wide:grid-cols-[76px_minmax(0,1fr)_auto]">
      <div className="relative row-span-2 size-16 self-start overflow-hidden border-[1.5px] border-ayc-navy bg-ayc-sand wide:row-span-1 wide:size-19">
        <ProductImage photo={product.photos[0] ?? null} alt="" sizes="76px" />
      </div>
      <div className="flex min-w-0 flex-col gap-1.25">
        <p className="flex flex-wrap items-center gap-1.5">
          <span className={cn(badge, "bg-ayc-navy px-1.5 py-1 text-ayc-cream")}>
            {productFormatLabel(product.format)}
          </span>
          {memberAppLive && product.availableInApp ? (
            <span
              className={cn(badge, "border-[1.5px] border-ayc-blue px-1.25 py-0.75 text-ayc-blue")}
            >
              {copy.alsoInApp}
            </span>
          ) : null}
        </p>
        <h4 className="text-[17px] leading-tight font-bold">
          <Link
            href={paths.products.details(product.slug)}
            className="text-ayc-navy no-underline after:absolute after:inset-0 hover:text-ayc-navy"
          >
            {product.shortName}
          </Link>
        </h4>
        {figures ? (
          <p className="font-mono text-xs text-ayc-slate">
            <RatingStar /> {formatRating(figures.rating)} · {formatCount(figures.unitsSold)} sold
          </p>
        ) : null}
      </div>
      {/* Under the name on a phone; its own column on wider screens. */}
      <p className="flex items-baseline gap-2.5 wide:flex-col wide:items-end wide:gap-1">
        <span className="text-lg font-extrabold whitespace-nowrap">
          {productPriceLabel(product)}
        </span>
        <span aria-hidden="true" className="text-lg text-ayc-blue">
          →
        </span>
      </p>
    </article>
  );
}
