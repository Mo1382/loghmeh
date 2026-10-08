/**
 * Normalize a username into its canonical form.
 *
 * Converts Arabic variants commonly used in Persian text
 * to their Persian equivalents.
 */
export function normalizeUsername(value) {
  if (typeof value !== "string") {
    return value;
  }

  return value.replace(/ي/g, "ی").replace(/ك/g, "ک");
}
