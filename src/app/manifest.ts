import type { MetadataRoute } from "next";

import { config } from "@/config";

import { BRAND_COLORS } from "./brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: config.site.name,
    short_name: "AYC",
    description: config.site.description,
    start_url: "/",
    display: "standalone",
    background_color: BRAND_COLORS.cream,
    theme_color: BRAND_COLORS.navy,
    // Served by app/icon.tsx (generated via next/og).
    icons: [{ src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" }],
  };
}
