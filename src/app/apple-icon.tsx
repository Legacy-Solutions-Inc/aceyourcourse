import { ImageResponse } from "next/og";

import { BRAND_COLORS, brandMark } from "./brand";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS adds its own rounded corners, so this is a plain square.
export default function AppleIcon() {
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
      {brandMark(124)}
    </div>,
    { ...size },
  );
}
