import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// The brand's shadow sizes (--shadow-* in globals.css). Without them,
// tailwind-merge reads `shadow-hard` as a colour, so a later `shadow-ayc-cream`
// would drop the shadow altogether.
const twMerge = extendTailwindMerge({
  extend: { theme: { shadow: ["hard-sm", "hard", "hard-md", "hard-lg", "panel", "note"] } },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
