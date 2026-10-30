import Link from "next/link";

import { websiteCopy } from "@/content/website";
import { paths } from "@/paths";

// Placeholder Home: the branded hero only. Later tickets build the rest of the
// mockup's Home (docs/mockup/website/Home_v2.dc.html).
export default function HomePage() {
  const copy = websiteCopy.home;

  return (
    <section className="bg-ayc-navy text-ayc-cream">
      <div className="mx-auto flex min-h-[clamp(480px,50vw,680px)] max-w-324 flex-col justify-center gap-6.5 px-[clamp(20px,5vw,72px)] py-[clamp(48px,6vw,96px)]">
        <p className="flex items-center gap-2.5 self-start rounded-full border-[1.5px] border-ayc-cream/50 px-3 py-2.25 font-mono text-xs leading-none font-bold tracking-[0.08em] uppercase">
          <span aria-hidden="true" className="size-2 rounded-full bg-ayc-orange" />
          {copy.eyebrow}
        </p>
        <h1 className="max-w-[13ch] text-[clamp(46px,7.2vw,108px)] leading-[0.92] font-extrabold tracking-[-0.045em] text-balance">
          {copy.headlineLead}{" "}
          {/* The marker is an underline, so contrast checks still see cream on navy. */}
          <span className="underline decoration-ayc-orange decoration-[0.3em] underline-offset-[-0.12em] [text-decoration-skip-ink:none]">
            {copy.headlineHighlight}
          </span>
        </h1>
        <p className="max-w-[31em] text-[clamp(17px,1.5vw,21px)] leading-normal text-pretty text-ayc-on-navy-soft">
          {copy.subheadline}
        </p>
        <Link
          href={paths.products.list}
          className="flex min-h-14 items-center gap-2.5 self-start border-[1.5px] border-ayc-cream bg-accent px-6 text-[17px] font-extrabold text-accent-foreground shadow-hard-md shadow-ayc-cream transition-[transform,box-shadow] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[7px_7px_0_var(--ayc-cream)] focus-visible:outline-ayc-cream motion-reduce:transition-none"
        >
          {copy.browseCta} <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}
