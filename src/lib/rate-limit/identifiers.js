import crypto from "node:crypto";

function hashValue(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

export function createUserIdentifier(prefix, userId) {
  return `${prefix}:user:${hashValue(userId)}`;
}

export function createIpIdentifier(prefix, ip) {
  return `${prefix}:ip:${hashValue(ip)}`;
}

export function createEmailIdentifier(prefix, email) {
  return `${prefix}:email:${hashValue(email.trim().toLowerCase())}`;
}

export function createLoginIdentifier(identifier) {
  const normalizedIdentifier = identifier.trim();

  const value = normalizedIdentifier.includes("@")
    ? normalizedIdentifier.toLowerCase()
    : normalizedIdentifier;

  return `auth:login:identifier:${hashValue(value)}`;
}
