"use client";

import { useEffect } from "react";

import { StatusPage } from "@/components/website/status-page";

// Catches errors thrown in root-level segments (the Website, auth, …). Renders
// inside the root layout, so the brand fonts and styles are in scope.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusPage
      code="Error"
      title="Something went wrong"
      description="An unexpected error stopped this page from loading. Try again, and if it keeps happening, email us."
      onReset={reset}
      digest={error.digest}
    />
  );
}
