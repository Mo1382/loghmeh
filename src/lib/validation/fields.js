/**
 * Return only explicitly allowed own properties from an object.
 *
 * This function does not validate the values.
 * It only controls which fields are allowed to pass through.
 */
export function pickAllowedFields(object, allowedFields) {
  if (!Array.isArray(allowedFields)) {
    throw new TypeError("allowedFields must be an array.");
  }

  if (
    allowedFields.some(
      (field) => typeof field !== "string" || field.length === 0
    )
  ) {
    throw new TypeError("allowedFields must contain non-empty strings.");
  }

  if (!object || typeof object !== "object" || Array.isArray(object)) {
    return {};
  }

  const result = {};

  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(object, field)) {
      Object.defineProperty(result, field, {
        value: object[field],
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
  }

  return result;
}
