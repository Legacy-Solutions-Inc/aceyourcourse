import { ImageResponse } from "next/og";

import { BRAND_COLORS, brandMark } from "./brand";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

// Favicon (also referenced by the web manifest): the brand mark on cream,
// generated via next/og so the repo ships no binary asset.
export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: BRAND_COLORS.cream,
      }}
    >
      {brandMark(400)}
    </div>,
    { ...size },
  );
}
