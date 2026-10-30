import Link from "next/link";
import { useId } from "react";

import { bestFor, examPageCopy } from "@/content/exam-pages";
import { productFormatLabel } from "@/lib/catalogue/format";
import { productPriceLabel } from "@/lib/catalogue/price";
import { cn } from "@/lib/utils";
import { paths } from "@/paths";
import type { Product } from "@/services/catalogue.types";

const copy = examPageCopy.compare;
const cell = "px-4 py-3.5";

interface CompareTableProps {
  /** The Exam's Products in best-seller order. Coming Soon ones are left out. */
  products: Product[];
  memberAppLive: boolean;
}

/**
 * "Which one should I get?": the Exam's Live Products side by side, with what
 * each format is best for. The In-the-app column shows only while the Member
 * App is live. Renders nothing with fewer than 2 Live Products.
 */
export function CompareTable({ products, memberAppLive }: CompareTableProps) {
  const headingId = useId();
  const live = products.filter((product) => product.state === "live");
  if (live.length < 2) return null;

  return (
    <section aria-labelledby={headingId} className="border-y-[1.5px] border-ayc-navy bg-ayc-sand">
      <div className="mx-auto flex max-w-324 flex-col gap-6 px-[clamp(20px,5vw,72px)] py-[clamp(56px,7vw,96px)]">
        <div className="flex flex-col gap-3">
          <p className="font-mono text-xs font-bold tracking-[0.08em] text-ayc-blue uppercase">
            {copy.eyebrow}
          </p>
          <h2
            id={headingId}
            className="text-[clamp(32px,4vw,52px)] leading-none font-extrabold tracking-[-0.035em]"
          >
            {copy.heading}
          </h2>
        </div>
        <div className="overflow-x-auto border-[1.5px] border-ayc-navy bg-ayc-paper">
          <table
            aria-labelledby={headingId}
            className="w-full min-w-160 border-collapse text-[15px]"
          >
            <thead>
              <tr className="bg-ayc-navy text-left font-mono text-[11px] font-bold tracking-[0.06em] text-ayc-cream uppercase">
                <th scope="col" className={cell}>
                  {copy.columns.reviewer}
                </th>
                <th scope="col" className={cell}>
                  {copy.columns.format}
                </th>
                <th scope="col" className={cell}>
                  {copy.columns.bestFor}
                </th>
                {memberAppLive ? (
                  <th scope="col" className={cell}>
                    {copy.columns.inApp}
                  </th>
                ) : null}
                <th scope="col" className={cn(cell, "text-right")}>
                  {copy.columns.price}
                </th>
              </tr>
            </thead>
            <tbody>
              {live.map((product) => (
                <tr key={product.id} className="border-t border-ayc-star-off">
                  <td className={cell}>
                    <Link
                      href={paths.products.details(product.slug)}
                      className="font-bold text-ayc-navy underline decoration-ayc-orange decoration-2 underline-offset-4 hover:text-ayc-blue"
                    >
                      {product.shortName}
                    </Link>
                  </td>
                  <td className={cn(cell, "font-mono text-[13px] font-medium")}>
                    {productFormatLabel(product.format)} · {product.size}
                  </td>
                  <td className={cn(cell, "text-ayc-slate")}>{bestFor[product.format]}</td>
                  {memberAppLive ? (
                    <td
                      className={cn(
                        cell,
                        "font-mono text-[13px] font-bold uppercase",
                        product.availableInApp ? "text-ayc-blue" : "text-ayc-slate",
                      )}
                    >
                      {product.availableInApp ? copy.inApp : copy.physicalOnly}
                    </td>
                  ) : null}
                  <td className={cn(cell, "text-right font-extrabold whitespace-nowrap")}>
                    {productPriceLabel(product)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
