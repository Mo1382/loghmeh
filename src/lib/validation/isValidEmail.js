import { EMAIL_PATTERN } from "@/constants/regex";

/**
 * Validate the persistence-level email format.
 *
 * Email normalization is handled by the schema (`trim` + `lowercase`);
 * this validator is responsible only for validating the resulting format.
 */

export function isValidEmail(value) {
  if (typeof value !== "string") {
    return false;
  }

  const email = value.trim();

  return email.length > 0 && email.length <= 254 && EMAIL_PATTERN.test(email);
}
