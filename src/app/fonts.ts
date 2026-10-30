import { JetBrains_Mono, Schibsted_Grotesk } from "next/font/google";

// The two brand typefaces, self-hosted by next/font (no request to Google at
// runtime, so the CSP needs no font host). Each exposes a CSS variable that
// globals.css maps to Tailwind's `font-sans` and `font-mono`. Shared by the root
// layout and global-error, which replaces the root layout.

export const schibstedGrotesk = Schibsted_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-schibsted-grotesk",
  display: "swap",
});

export const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const fontVariables = `${schibstedGrotesk.variable} ${jetBrainsMono.variable}`;
