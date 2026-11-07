// Brand values for places CSS variables can't reach: the next/og images (the
// favicon, the Apple icon and the share image), the web manifest and the
// viewport theme colour. They mirror the tokens in globals.css.
export const BRAND_COLORS = {
  cream: "#f6f1e7",
  navy: "#0e1a2e",
  orange: "#ff881f",
  onNavySoft: "#d9dee6",
} as const;

// The brand mark (public/brand/brand-mark.svg, without its metadata) as JSX,
// inlined so generating an image needs no file read or fetch.
const VIEW_BOX = { width: 180.03, height: 200.11 };

export function brandMark(height: number) {
  return (
    <svg
      width={Math.round((height * VIEW_BOX.width) / VIEW_BOX.height)}
      height={height}
      viewBox={`0 0 ${VIEW_BOX.width} ${VIEW_BOX.height}`}
    >
      <path
        fill="#ff881f"
        d="M125.43,126.13q-.06,16.2-9.57,26.61T90.72,163.2a33.94,33.94,0,0,1-18-4.72,33.16,33.16,0,0,1-12.25-13.15A40.45,40.45,0,0,1,56,126.64L28.7,110.86a74.73,74.73,0,0,0-1.52,15.34A66.85,66.85,0,0,0,35,158.48a60.3,60.3,0,0,0,21.18,22.84,55.2,55.2,0,0,0,30,8.42,51.35,51.35,0,0,0,25-6,44.87,44.87,0,0,0,12.51-10v26.36l14-12.93,14,1.44V111Z"
      />
      <path
        fill="#005aa5"
        d="M179.51,80a2.79,2.79,0,0,1-.91.82L150.13,97.23,97.07,66.52a9.31,9.31,0,0,0-9.38,0L72.24,75.44a3.31,3.31,0,0,0,0,5.74L85.83,89h0l39.46,22.6L94.79,129.18a9.55,9.55,0,0,1-9.56,0L57.73,113.3,32.51,98.74,1.43,80.79a2.7,2.7,0,0,1-.75-.62,2.86,2.86,0,0,1,.75-4.33l83.8-48.39a9.6,9.6,0,0,1,9.56,0L178.6,75.84A2.87,2.87,0,0,1,179.51,80Z"
      />
      <path
        fill="#ff881f"
        d="M149.31,18a25,25,0,0,0,8.15,8.15,24.9,24.9,0,0,0-8.15,8.15,24.8,24.8,0,0,0-8.15-8.15A24.9,24.9,0,0,0,149.31,18m0-18a1.69,1.69,0,0,0-1.73,1.53l-.75,5.83a18.82,18.82,0,0,1-16.28,16.28l-5.83.74a1.75,1.75,0,0,0,0,3.47l5.83.75a18.81,18.81,0,0,1,16.28,16.28l.75,5.83a1.75,1.75,0,0,0,3.47,0l.74-5.83A18.82,18.82,0,0,1,168.07,28.6l5.83-.75a1.75,1.75,0,0,0,0-3.47l-5.83-.74A18.83,18.83,0,0,1,151.79,7.36l-.74-5.83A1.7,1.7,0,0,0,149.31,0Z"
      />
    </svg>
  );
}
