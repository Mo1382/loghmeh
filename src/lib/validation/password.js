const BCRYPT_MAX_PASSWORD_BYTES = 72;

const encoder = new TextEncoder();

/**
 * Check whether a password is a well-formed UTF-16 string.
 *
 * Rejects strings containing unpaired high or low surrogates.
 * Does not modify or normalize the password.
 *
 * @param {unknown} password - Value to validate.
 * @returns {boolean} Whether the password is a well-formed string.
 */
export function isWellFormedPassword(password) {
  return typeof password === "string" && password.isWellFormed();
}

/**
 * Check whether a password fits bcrypt's 72-byte UTF-8 limit.
 *
 * This function only checks bcrypt byte compatibility.
 * Password length and other password requirements are validated separately.
 *
 * @param {unknown} password - Value to validate.
 * @returns {boolean} Whether the password is a string within the byte limit.
 */
export function isWithinBcryptByteLimit(password) {
  return (
    typeof password === "string" &&
    encoder.encode(password).byteLength <= BCRYPT_MAX_PASSWORD_BYTES
  );
}
