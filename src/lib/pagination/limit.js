/**
 * Normalize a pagination limit.
 *
 * Invalid, non-positive, or non-integer values fall back
 * to the provided default.
 */
export function normalizeLimit(limit, defaultLimit = 16, maxLimit = 50) {
  if (!Number.isInteger(defaultLimit) || defaultLimit <= 0) {
    throw new TypeError("defaultLimit باید یک عدد صحیح مثبت باشد.");
  }

  if (!Number.isInteger(maxLimit) || maxLimit <= 0) {
    throw new TypeError("maxLimit باید یک عدد صحیح مثبت باشد.");
  }

  if (defaultLimit > maxLimit) {
    throw new RangeError("defaultLimit نمی‌تواند بزرگ‌تر از maxLimit باشد.");
  }

  const parsedLimit = Number(limit);

  if (!Number.isInteger(parsedLimit) || parsedLimit <= 0) {
    return defaultLimit;
  }

  return Math.min(parsedLimit, maxLimit);
}
