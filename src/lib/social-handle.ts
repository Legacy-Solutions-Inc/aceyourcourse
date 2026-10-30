/**
 * Pure: the "@handle" shown next to a social profile link, read from the
 * profile URL's last path segment: "https://www.tiktok.com/@aceyourcourse" →
 * "@aceyourcourse". Null when the URL has no path or isn't a URL, so the
 * caller can show the network name alone.
 */
export function socialHandle(profileUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(profileUrl);
  } catch {
    return null;
  }
  const last = url.pathname.split("/").filter(Boolean).at(-1);
  if (!last) return null;
  return last.startsWith("@") ? last : `@${last}`;
}
