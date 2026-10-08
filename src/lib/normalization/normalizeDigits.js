/**
 * Normalize Persian and Arabic-Indic digits to ASCII digits.
 *
 * Example:
 * ۱۲۳۴۵۶ → 123456
 * ١٢٣٤٥٦ → 123456
 */
export function normalizeDigits(value) {
  if (typeof value !== "string") {
    return value;
  }

  return value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
}
