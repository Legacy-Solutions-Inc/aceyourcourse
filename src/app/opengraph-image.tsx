import { ImageResponse } from "next/og";

import { config } from "@/config";
import { websiteCopy } from "@/content/website";

import { BRAND_COLORS, brandMark } from "./brand";

// Next auto-wires this generated image into openGraph.images / twitter.images.
export const alt = `${config.site.name}: ${websiteCopy.home.headlineLead} ${websiteCopy.home.headlineHighlight}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  const copy = websiteCopy.home;

  return new ImageResponse(
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: BRAND_COLORS.navy,
        color: BRAND_COLORS.cream,
        padding: "72px 80px",
        borderBottom: `16px solid ${BRAND_COLORS.orange}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        {brandMark(72)}
        <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-0.02em" }}>
          {websiteCopy.wordmark}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        <div
          style={{
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: "0.08em",
            color: BRAND_COLORS.orange,
            textTransform: "uppercase",
          }}
        >
          {copy.eyebrow}
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            fontSize: 88,
            fontWeight: 800,
            lineHeight: 1,
            letterSpacing: "-0.04em",
            maxWidth: 980,
          }}
        >
          {copy.headlineLead}&nbsp;
          <span style={{ color: BRAND_COLORS.orange }}>{copy.headlineHighlight}</span>
        </div>
        <div
          style={{ fontSize: 30, lineHeight: 1.35, color: BRAND_COLORS.onNavySoft, maxWidth: 940 }}
        >
          {config.site.description}
        </div>
      </div>
    </div>,
    { ...size },
  );
}
