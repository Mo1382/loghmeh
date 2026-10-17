/**
/**
 * Normalize common Arabic character variants in Persian usernames.
 *
 * Converts Arabic Yeh (ي) to Persian Yeh (ی)
 * and Arabic Kaf (ك) to Persian Kaf (ک).
 */

export function normalizeUsername(value) {
  if (typeof value !== "string") {
    return value;
  }

  return value.replace(/ي/g, "ی").replace(/ك/g, "ک");
}
