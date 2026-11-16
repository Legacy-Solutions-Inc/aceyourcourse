import localFont from "next/font/local";

// The two brand typefaces, self-hosted by next/font (no request to Google at
// runtime, so the CSP needs no font host). Each exposes a CSS variable that
// globals.css maps to Tailwind's `font-sans` and `font-mono`. Shared by the root
// layout and global-error, which replaces the root layout.
//
// The files live in ./fonts, so the build never fetches from Google Fonts
// either: next/font/google's download failed one Vercel build. They are Google
// Fonts' latin variable files (Schibsted Grotesk 400–900, JetBrains Mono
// 400–700), under the SIL Open Font License beside them.

export const schibstedGrotesk = localFont({
  src: "./fonts/schibsted-grotesk-latin.woff2",
  weight: "400 900",
  variable: "--font-schibsted-grotesk",
  display: "swap",
});

export const jetBrainsMono = localFont({
  src: "./fonts/jetbrains-mono-latin.woff2",
  weight: "400 700",
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const fontVariables = `${schibstedGrotesk.variable} ${jetBrainsMono.variable}`;
