import type { Metadata } from "next";

import { StatusPage } from "@/components/website/status-page";

export const metadata: Metadata = { title: "Page not found" };

// A notFound() from a Website page (an unknown or hidden Product) renders this
// inside the Website shell, with HTTP status 404. Unmatched URLs use the root
// not-found page.
export default function WebsiteNotFound() {
  return (
    <StatusPage
      withinShell
      code="404"
      title="Page not found"
      description="The page you're looking for doesn't exist or has moved. Try Home, or browse every reviewer."
    />
  );
}
