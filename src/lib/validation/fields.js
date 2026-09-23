/**
 * Return only explicitly allowed own properties from an object.
 *
 * This function does not validate the values.
 * It only controls which fields are allowed to pass through.
 */
export function pickAllowedFields(object, allowedFields) {
  if (!object || typeof object !== "object" || Array.isArray(object)) {
    return {};
  }

  if (!Array.isArray(allowedFields)) {
    throw new TypeError("allowedFields must be an array.");
  }

  const result = {};

  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(object, field)) {
      result[field] = object[field];
    }
  }

  return result;
}
