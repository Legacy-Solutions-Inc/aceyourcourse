"use client";

/** "Print or save as PDF": the browser's own print, so no file is made on the server. */
export function PrintButton({ className }: { className?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={className}>
      Print or save as PDF
    </button>
  );
}
