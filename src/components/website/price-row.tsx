/**
 * A Product's price, large, with the deal badge beside it. The price element
 * is live, so a screen reader hears it change when a variation is picked.
 */
export function PriceRow({ price, deal }: { price: React.ReactNode; deal: string | null }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4.5 gap-y-3 border-y-[1.5px] border-ayc-navy py-4">
      <p
        data-testid="product-price"
        aria-live="polite"
        className="text-[clamp(36px,4vw,52px)] leading-none font-black tracking-[-0.03em]"
      >
        {price}
      </p>
      {deal ? (
        <p className="border-[1.5px] border-ayc-navy bg-ayc-orange px-2 py-1.75 font-mono text-[11px] leading-none font-bold text-ayc-navy uppercase">
          {deal}
        </p>
      ) : null}
    </div>
  );
}
