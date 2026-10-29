const BCRYPT_MAX_PASSWORD_BYTES = 72;

const encoder = new TextEncoder();

export function isBcryptCompatiblePassword(password) {
  return (
    typeof password === "string" &&
    encoder.encode(password).length <= BCRYPT_MAX_PASSWORD_BYTES
  );
}
