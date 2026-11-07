import Link from "next/link";

import type { AttentionItem, AttentionTone } from "@/lib/admin/needs-attention";
import { cn } from "@/lib/utils";

/** The row's square (mockup 1579–1583): amber to fix, blue to check, grey for something off. */
const TONE: Record<AttentionTone, string> = {
  warning: "bg-ayc-star",
  info: "bg-ayc-blue",
  quiet: "bg-ayc-on-navy-muted",
};

/** The Overview's Needs attention panel (mockup 723–726): each row links to the screen that fixes it. */
export function NeedsAttentionList({ items }: { items: AttentionItem[] }) {
  return (
    <section
      aria-labelledby="needs-attention"
      className="flex max-w-3xl flex-col border-[1.5px] bg-ayc-paper shadow-hard"
    >
      <div className="flex items-center justify-between gap-2.5 border-b-[1.5px] px-4 py-3.5">
        <h2 id="needs-attention" className="text-lg font-extrabold tracking-[-0.01em]">
          Needs attention
        </h2>
        <span className="border bg-ayc-orange px-1.75 py-1.25 font-mono text-[11px] leading-none font-bold">
          {items.length}
        </span>
      </div>
      <ul aria-label="Needs attention">
        {items.map((item) => (
          <li key={item.kind}>
            <Link
              href={item.href}
              className="flex items-center gap-3 border-b border-ayc-rule px-4 py-3 transition-colors hover:bg-ayc-sand motion-reduce:transition-none"
            >
              <span aria-hidden className={cn("size-2.5 flex-none border", TONE[item.tone])} />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm font-bold">{item.title}</span>
                <span className="text-xs leading-[1.4] text-ayc-slate">{item.detail}</span>
              </span>
              <span className="text-[13px] font-bold whitespace-nowrap text-ayc-blue">
                {item.action} →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
