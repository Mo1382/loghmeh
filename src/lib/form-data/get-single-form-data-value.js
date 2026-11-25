/**
 * Return the single value associated with a FormData field.
 *
 * Returns:
 * - undefined when the field is missing.
 * - null when the field contains multiple values.
 * - The original value when exactly one value exists.
 *
 * Returning null for duplicate values ensures that schema defaults
 * cannot silently replace ambiguous submitted values.
 */
export function getSingleFormDataValue(formData, name) {
  const values = formData.getAll(name);

  if (values.length === 0) {
    return undefined;
  }

  if (values.length > 1) {
    return null;
  }

  return values[0];
}
