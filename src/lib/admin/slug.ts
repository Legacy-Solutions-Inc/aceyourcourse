// A new Product's page address, /products/{slug}, and a new FAQ's deep link,
// /faq#faq-{slug} (spec, Phase 2 → Products, FAQ: each is set when the record
// is created and stays fixed afterwards). The catalogue's rule is kebab-case:
// lowercase ASCII letters and digits joined by single hyphens.

/** How long a slug can be, and what one with no letters or digits is called. */
export interface SlugOptions {
  max: number;
  fallback: string;
}

/** A Product's page address. */
const PRODUCT: SlugOptions = { max: 60, fallback: "product" };

/** Pure: a name's slug, at most 60 characters, cut at a word where it can be. */
export function slugify(name: string, { max, fallback }: SlugOptions = PRODUCT): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    // "Lepaña’s" is one word: "lepanas", not "lepana-s".
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cut(slug, max) || fallback;
}

/** Pure: the name's slug, or with -2, -3… when another record already has it. */
export function uniqueSlug(
  name: string,
  taken: Iterable<string>,
  options: SlugOptions = PRODUCT,
): string {
  const used = new Set(taken);
  const slug = slugify(name, options);
  if (!used.has(slug)) return slug;
  for (let n = 2; ; n++) {
    const suffix = `-${n}`;
    const candidate = `${cut(slug, options.max - suffix.length)}${suffix}`;
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
