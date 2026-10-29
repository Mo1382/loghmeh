/**
 * UUID v4 format used for verification-code generations.
 */
export const GENERATION_ID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(?![\s\S])/i;

/**
 * Validate a verification-code generation ID.
 */
export function isStrictGenerationId(value) {
  return typeof value === "string" && GENERATION_ID_REGEX.test(value);
}
