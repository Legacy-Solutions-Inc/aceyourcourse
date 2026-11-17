/** The label for a User-Agent this parser can't name both the browser and the system of. */
export const UNKNOWN_DEVICE = "Unknown browser";

type Browser = "Chrome" | "Safari" | "Firefox" | "Edge" | "Samsung Internet";
type System = "Android" | "iOS" | "macOS" | "Windows" | "Linux";

/**
 * Chromium browsers outside the five that announce themselves; without this
 * check each would read as Chrome.
 */
const OTHER_CHROMIUM = /\b(?:OPR|Opera|Vivaldi|YaBrowser|UCBrowser)\//;

function systemOf(ua: string): System | null {
  // iOS before macOS: every iPhone and iPad User-Agent says "like Mac OS X".
  if (/\b(?:iPhone|iPad|iPod)\b/.test(ua)) return "iOS";
  // Android before Linux: Android's User-Agent says "Linux" too.
  if (/\bAndroid\b/.test(ua)) return "Android";
  if (/\b(?:Macintosh|Mac OS X)\b/.test(ua)) return "macOS";
  if (/\bWindows\b/.test(ua)) return "Windows";
  // ChromeOS says "CrOS", never "Linux", so it stays unknown.
  if (/\bLinux\b/.test(ua)) return "Linux";
  return null;
}

function browserOf(ua: string, system: System): Browser | null {
  if (OTHER_CHROMIUM.test(ua)) return null;
  // Samsung Internet and Edge say "Chrome" too, so they go first.
  if (/\bSamsungBrowser\//.test(ua)) return "Samsung Internet";
  if (/\bEdg(?:e|A|iOS)?\//.test(ua)) return "Edge";
  if (/\b(?:Firefox|FxiOS)\//.test(ua)) return "Firefox";
  // "HeadlessChrome/" is Chrome too.
  if (/(?:Chrome|CriOS)\//.test(ua)) return "Chrome";
  // Only Apple's systems have Safari: Android's old stock browser says it too.
  const apple = system === "iOS" || system === "macOS";
  if (apple && /\bVersion\/[\d.]+.*\bSafari\//.test(ua)) return "Safari";
  return null;
}

/** User-Agents are short; anything past this is ignored. */
const MAX_LENGTH = 512;

/**
 * Pure: the device label on an Active Device switch, "{Browser} on {OS}", for
 * Chrome, Safari, Firefox, Edge and Samsung Internet on Android, iOS, macOS,
 * Windows and Linux (spec, Phase 3 → Active Device). Anything else, or a
 * User-Agent missing either part, is "Unknown browser". It's a label for
 * people, never a security check: the browser writes its own User-Agent.
 */
export function deviceLabel(userAgent: string | null | undefined): string {
  const ua = (userAgent ?? "").slice(0, MAX_LENGTH);
  const system = systemOf(ua);
  const browser = system ? browserOf(ua, system) : null;
  return system && browser ? `${browser} on ${system}` : UNKNOWN_DEVICE;
}
