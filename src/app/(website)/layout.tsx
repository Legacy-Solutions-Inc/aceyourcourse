import { SiteFooter } from "@/components/website/site-footer";
import { SiteNav } from "@/components/website/site-nav";

// The Website shell: every public page gets the announcement bar, the site
// navigation and the footer.
export default function WebsiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <a
        href="#main"
        className="sr-only z-70 bg-accent px-4 py-3 font-bold text-accent-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <SiteNav />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
