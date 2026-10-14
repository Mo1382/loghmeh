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

  try {
    assertValidObjectId(payload[field], `cursor ${field}`);
  } catch (error) {
    // A malformed owner ID inside a cursor is a cursor error,
    // not an invalid request identifier supplied separately.
    if (
      error instanceof AppError &&
      error.code === ERROR_CODES.INVALID_REQUEST
    ) {
      throw new AppError(
        ERROR_CODES.INVALID_CURSOR,
        "شناسه نشانگر صفحه‌بندی نامعتبر است.",
        { statusCode: 400 }
      );
    }

    // Preserve unexpected validation errors.
    throw error;
  }

  const cursorOwnerId = payload[field].toString().toLowerCase();
  const expectedOwnerId = expectedId.toString().toLowerCase();

  if (cursorOwnerId !== expectedOwnerId) {
    throw new AppError(ERROR_CODES.INVALID_CURSOR, message, {
      statusCode: 400,
    });
  }
}
