// A new Product's page address, /products/{slug} (spec, Phase 2 → Products:
// "The page address is set from the name when the Product is created and
// stays fixed afterwards"). The catalogue's rule is kebab-case: lowercase
// ASCII letters and digits joined by single hyphens.

const MAX_LENGTH = 60;
const FALLBACK = "product";

/** Pure: a name's slug, at most 60 characters, cut at a word where it can be. */
export function slugify(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    // "Lepaña’s" is one word: "lepanas", not "lepana-s".
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cut(slug, MAX_LENGTH) || FALLBACK;
}

/** Pure: the name's slug, or with -2, -3… when a Product already has it. */
export function uniqueSlug(name: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const slug = slugify(name);
  if (!used.has(slug)) return slug;
  for (let n = 2; ; n++) {
    const suffix = `-${n}`;
    const candidate = `${cut(slug, MAX_LENGTH - suffix.length)}${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
}

/** Pure: a slug at most `max` long, ending at a whole word when it has a hyphen to cut at. */
function cut(slug: string, max: number): string {
  if (slug.length <= max) return slug;
  const head = slug.slice(0, max);
  const lastHyphen = head.lastIndexOf("-");
  return (lastHyphen > 0 ? head.slice(0, lastHyphen) : head).replace(/-+$/, "");
}
