/**
 * Check whether a value is an HTTPS URL without embedded credentials.
 */
export function isHttpsUrl(value) {
  if (typeof value !== "string") {
    return false;
  }

  try {
    const url = new URL(value);

    return (
      url.protocol === "https:" &&
      Boolean(url.hostname) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}
