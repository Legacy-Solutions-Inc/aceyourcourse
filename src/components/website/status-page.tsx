import Link from "next/link";

import { BrandLogo } from "@/components/website/brand-logo";
import { config } from "@/config";
import { cn } from "@/lib/utils";
import { paths } from "@/paths";

interface StatusPageProps {
  /** A short label above the title, e.g. "404". */
  code: string;
  title: string;
  description: string;
  /** When provided, renders a "Try again" button wired to this handler. */
  onReset?: () => void;
  /** Opaque support reference (e.g. a Next.js error digest). Never the raw error. */
  digest?: string;
}

const button =
  "flex min-h-12 items-center border-[1.5px] px-5 text-[15px] font-extrabold transition-[transform,box-shadow] motion-reduce:transition-none";

/**
 * The branded full-page 404 and error screen. It takes presentational copy
 * only, never a raw error, so internal details can't leak to Visitors. No
 * hooks, so both Server (not-found) and Client (error) boundaries can use it.
 */
export function StatusPage({ code, title, description, onReset, digest }: StatusPageProps) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background px-5 py-16 text-center">
      <Link href={paths.home}>
        <BrandLogo alt={config.site.name} />
      </Link>
      <p className="font-mono text-sm font-bold tracking-[0.08em] text-ayc-blue uppercase">
        {code}
      </p>
      <h1 className="text-[clamp(32px,5vw,56px)] leading-none font-extrabold tracking-tight text-balance">
        {title}
      </h1>
      <p className="max-w-md text-lg text-muted-foreground">{description}</p>
      <div className="flex flex-wrap justify-center gap-3">
        {onReset ? (
          <button
            type="button"
            onClick={onReset}
            className={cn(button, "cursor-pointer bg-primary text-primary-foreground")}
          >
            Try again
          </button>
        ) : null}
        <Link
          href={paths.home}
          className={cn(
            button,
            "bg-accent text-accent-foreground shadow-hard-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-md",
          )}
        >
          Back to Home
        </Link>
        <Link href={paths.products.list} className={cn(button, "hover:bg-ayc-sand")}>
          Browse products
        </Link>
      </div>
      {digest ? (
        <p className="font-mono text-xs text-muted-foreground">Reference: {digest}</p>
      ) : null}
    </main>
  );
}
