// Shopee figures as the Website shows them, e.g. "4.8" and "1,234".

const countFormat = new Intl.NumberFormat("en-PH");

/** A star rating to one decimal place: 5 → "5.0". */
export function formatRating(rating: number): string {
  return rating.toFixed(1);
}

/** A count of ratings or units sold, grouped the Philippine way: 1234 → "1,234". */
export function formatCount(count: number): string {
  return countFormat.format(count);
}
