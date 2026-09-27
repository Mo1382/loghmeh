import AppError from "@/lib/errors/AppError";
import { ERROR_CODES } from "@/constants/error-codes";

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

  if (limit === undefined || limit === null) {
    return defaultLimit;
  }

  if (typeof limit !== "number" || !Number.isInteger(limit)) {
    throw new AppError(
      ERROR_CODES.INVALID_LIMIT,
      "مقدار تعداد نتایج نامعتبر است.",
      { statusCode: 400 }
    );
  }

  if (limit <= 0) {
    throw new AppError(
      ERROR_CODES.INVALID_LIMIT,
      "مقدار تعداد نتایج نامعتبر است.",
      { statusCode: 400 }
    );
  }

  return Math.min(limit, maxLimit);
}
