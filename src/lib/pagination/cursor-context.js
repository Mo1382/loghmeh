import AppError from "@/lib/errors/AppError";
import { ERROR_CODES } from "@/constants/error-codes";
import { assertValidObjectId } from "@/lib/validation/object-id";

export function assertCursorResource(payload, expectedResource) {
  if (payload?.resource !== expectedResource) {
    throw new AppError(
      ERROR_CODES.INVALID_CURSOR,
      "نشانگر صفحه‌بندی نامعتبر است.",
      { statusCode: 400 }
    );
  }
}

export function assertCursorOwner(
  payload,
  field,
  expectedId,
  message = "نشانگر صفحه‌بندی متعلق به این منبع نیست."
) {
  if (!payload?.[field]) {
    throw new AppError(
      ERROR_CODES.INVALID_CURSOR,
      "نشانگر صفحه‌بندی نامعتبر است.",
      { statusCode: 400 }
    );
  }

  assertValidObjectId(payload[field], `cursor ${field}`);

  if (payload[field].toString() !== expectedId.toString()) {
    throw new AppError(ERROR_CODES.INVALID_CURSOR, message, {
      statusCode: 400,
    });
  }
}
