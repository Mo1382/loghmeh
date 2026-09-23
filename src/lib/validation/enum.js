import { ERROR_CODES } from "@/constants/error-codes";
import { AppError } from "@/lib/errors/AppError";

/**
 * Ensure that a value is one of the allowed enum values.
 */
export function assertEnum(
  value,
  allowedValues,
  {
    errorCode = ERROR_CODES.INVALID_REQUEST,
    message = "مقدار واردشده نامعتبر است.",
    statusCode = 400,
  } = {}
) {
  if (!Array.isArray(allowedValues)) {
    throw new TypeError("allowedValues must be an array.");
  }

  if (!allowedValues.includes(value)) {
    throw new AppError(errorCode, message, { statusCode });
  }

  return value;
}
