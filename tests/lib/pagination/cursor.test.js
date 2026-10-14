import crypto from "node:crypto";
import mongoose from "mongoose";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AppError from "@/lib/errors/AppError";
import { ERROR_CODES } from "@/constants/error-codes";
import { CURSOR_VERSION } from "@/constants/enums";

import {
  decodeCursor,
  encodeCursor,
  normalizeCreatedAtIdCursor,
} from "@/lib/pagination/cursor";

// ============================================================================
// Test Constants
// ============================================================================

const TEST_SECRET = "a".repeat(64);
const OTHER_SECRET = "b".repeat(64);

const VALID_ID = "64b7f0c2d4e6a8b0c1d2e3f4";
const VALID_CREATED_AT = "2026-01-02T03:04:05.000Z";

const BASE64URL_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

// ============================================================================
// Test Helpers
// ============================================================================

function captureThrownError(callback) {
  try {
    callback();
  } catch (error) {
    return error;
  }

  throw new Error("Expected the callback to throw an error.");
}

function expectAppError(
  callback,
  code = ERROR_CODES.INVALID_CURSOR,
  statusCode = 400
) {
  const error = captureThrownError(callback);

  expect(error).toBeInstanceOf(AppError);
  expect(error.code).toBe(code);
  expect(error.statusCode).toBe(statusCode);

  return error;
}

function signPayloadBase64(payloadBase64, secret = TEST_SECRET) {
  return crypto
    .createHmac("sha256", secret)
    .update(payloadBase64)
    .digest("base64url");
}

function createSignedCursorFromPayloadBase64(
  payloadBase64,
  secret = TEST_SECRET
) {
  const signature = signPayloadBase64(payloadBase64, secret);

  return `${payloadBase64}.${signature}`;
}

/**
 * Creates a valid HMAC-signed cursor from a JSON string.
 *
 * This allows tests to reach JSON parsing and payload validation
 * without failing earlier at signature verification.
 */
function createSignedCursorFromJson(json, secret = TEST_SECRET) {
  const payloadBase64 = Buffer.from(json, "utf8").toString("base64url");

  return createSignedCursorFromPayloadBase64(payloadBase64, secret);
}

/**
 * Produces a noncanonical Base64URL representation of the same bytes.
 *
 * Base64URL strings whose lengths have remainders 2 or 3 modulo 4
 * contain unused trailing bits. Changing those bits should not change
 * the decoded bytes, but must be rejected by canonical validation.
 */
function makeNonCanonicalBase64Url(encoded) {
  const remainder = encoded.length % 4;

  let significantBitsMask;
  let unusedBitsMask;

  if (remainder === 2) {
    significantBitsMask = 0b110000;
    unusedBitsMask = 0b001111;
  } else if (remainder === 3) {
    significantBitsMask = 0b111100;
    unusedBitsMask = 0b000011;
  } else {
    throw new Error(
      "Cannot create a noncanonical Base64URL representation for this length."
    );
  }

  const lastCharacter = encoded.at(-1);
  const lastIndex = BASE64URL_ALPHABET.indexOf(lastCharacter);

  if (lastIndex < 0) {
    throw new Error("Expected a valid Base64URL string.");
  }

  const currentUnusedBits = lastIndex & unusedBitsMask;

  // Change only unused trailing bits, preserving the decoded bytes.
  const replacementUnusedBits = currentUnusedBits === 1 ? 2 : 1;

  const replacementIndex =
    (lastIndex & significantBitsMask) | replacementUnusedBits;

  const replacement =
    encoded.slice(0, -1) + BASE64URL_ALPHABET[replacementIndex];

  if (
    replacement === encoded ||
    !Buffer.from(replacement, "base64url").equals(
      Buffer.from(encoded, "base64url")
    )
  ) {
    throw new Error(
      "Failed to create a noncanonical Base64URL representation."
    );
  }

  return replacement;
}

/**
 * Creates a correctly signed cursor whose payload uses a noncanonical
 * Base64URL representation.
 *
 * The signature is calculated over the noncanonical representation
 * itself, ensuring that signature verification alone cannot detect it.
 */
function createSignedCursorWithNoncanonicalPayload(
  payload,
  secret = TEST_SECRET
) {
  let candidatePayload = { ...payload };
  let payloadBase64 = Buffer.from(
    JSON.stringify(candidatePayload),
    "utf8"
  ).toString("base64url");

  let paddingLength = 0;

  while (payloadBase64.length % 4 === 0) {
    paddingLength += 1;

    candidatePayload = {
      ...payload,
      __padding: "x".repeat(paddingLength),
    };

    payloadBase64 = Buffer.from(
      JSON.stringify(candidatePayload),
      "utf8"
    ).toString("base64url");
  }

  const noncanonicalPayloadBase64 = makeNonCanonicalBase64Url(payloadBase64);

  return createSignedCursorFromPayloadBase64(noncanonicalPayloadBase64, secret);
}

function createValidPayload(overrides = {}) {
  return {
    resource: "recipes",
    sort: "NEWEST",
    value: VALID_CREATED_AT,
    id: VALID_ID,
    ...overrides,
  };
}

function createValidCursor(payload = createValidPayload()) {
  return encodeCursor(payload);
}

beforeEach(() => {
  vi.stubEnv("CURSOR_SECRET", TEST_SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ============================================================================
// encodeCursor
// ============================================================================

describe("encodeCursor", () => {
  it("encodes a valid payload into a two-part cursor string", () => {
    const payload = createValidPayload();

    const cursor = encodeCursor(payload);
    const parts = cursor.split(".");

    expect(typeof cursor).toBe("string");
    expect(parts).toHaveLength(2);
    expect(parts[0]).not.toBe("");
    expect(parts[1]).not.toBe("");
  });

  it("preserves payload fields and adds the current cursor version", () => {
    const payload = createValidPayload();

    const decodedPayload = decodeCursor(encodeCursor(payload));

    expect(decodedPayload).toEqual({
      ...payload,
      v: CURSOR_VERSION,
    });
  });

  it("overwrites a caller-provided cursor version", () => {
    const payload = createValidPayload({
      v: "unsupported-version",
    });

    const decodedPayload = decodeCursor(encodeCursor(payload));

    expect(decodedPayload.v).toBe(CURSOR_VERSION);
    expect(decodedPayload.v).not.toBe("unsupported-version");
  });

  it.each([
    { label: "null", payload: null },
    { label: "undefined", payload: undefined },
    { label: "a string", payload: "invalid" },
    { label: "a number", payload: 123 },
    { label: "a boolean", payload: true },
    { label: "an array", payload: [] },
  ])("rejects $label as a payload", ({ payload }) => {
    expectAppError(() => encodeCursor(payload));
  });

  // --------------------------------------------------------------------------
  // Reject non-plain objects
  // --------------------------------------------------------------------------

  it.each([
    {
      label: "a Date instance",
      payload: new Date(VALID_CREATED_AT),
    },
    {
      label: "a Map instance",
      payload: new Map([["key", "value"]]),
    },
    {
      label: "a Set instance",
      payload: new Set(["value"]),
    },
  ])("rejects $label as a payload", ({ payload }) => {
    expectAppError(() => encodeCursor(payload));
  });

  it("rejects an instance of a custom class as a payload", () => {
    class CustomPayload {
      constructor() {
        this.id = VALID_ID;
      }
    }

    expectAppError(() => encodeCursor(new CustomPayload()));
  });

  it("rejects a payload containing a circular reference", () => {
    const payload = createValidPayload();

    payload.nested = payload;

    expectAppError(() => encodeCursor(payload));
  });

  it("rejects a payload containing a BigInt", () => {
    const payload = createValidPayload({
      count: BigInt(10),
    });

    expectAppError(() => encodeCursor(payload));
  });

  it("reports a missing cursor secret as an internal server error", () => {
    vi.stubEnv("CURSOR_SECRET", "");

    expectAppError(
      () => encodeCursor(createValidPayload()),
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      500
    );
  });

  it.each([
    {
      label: "a secret that is too short",
      secret: "a".repeat(63),
    },
    {
      label: "a secret containing non-hexadecimal characters",
      secret: "g".repeat(64),
    },
  ])("rejects $label as an internal server error", ({ secret }) => {
    vi.stubEnv("CURSOR_SECRET", secret);

    expectAppError(
      () => encodeCursor(createValidPayload()),
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      500
    );
  });
});

// ============================================================================
// decodeCursor
// ============================================================================

describe("decodeCursor", () => {
  it.each([null, undefined, ""])(
    "returns null when the cursor is %s",
    (cursor) => {
      expect(decodeCursor(cursor)).toBeNull();
    }
  );

  it("decodes a valid cursor generated by encodeCursor", () => {
    const payload = createValidPayload();

    const decodedPayload = decodeCursor(encodeCursor(payload));

    expect(decodedPayload).toEqual({
      ...payload,
      v: CURSOR_VERSION,
    });
  });

  it.each([
    { label: "a number", cursor: 123 },
    { label: "a boolean", cursor: false },
    { label: "an object", cursor: {} },
    { label: "an array", cursor: [] },
  ])("rejects $label as a cursor", ({ cursor }) => {
    expectAppError(() => decodeCursor(cursor));
  });

  it.each([
    ".",
    ".signature",
    "payload.",
    "payload.signature.extra",
    "invalid-cursor",
  ])("rejects a malformed cursor string: %s", (cursor) => {
    expectAppError(() => decodeCursor(cursor));
  });

  it("rejects a cursor with a modified signature", () => {
    const cursor = createValidCursor();
    const [payloadBase64, signatureBase64] = cursor.split(".");

    const replacementFirstCharacter = signatureBase64[0] === "A" ? "B" : "A";

    const tamperedSignature =
      replacementFirstCharacter + signatureBase64.slice(1);

    expectAppError(() => decodeCursor(`${payloadBase64}.${tamperedSignature}`));
  });

  // --------------------------------------------------------------------------
  // Strict Base64URL validation
  // --------------------------------------------------------------------------

  it("rejects a signature containing invalid Base64URL characters", () => {
    const cursor = createValidCursor();
    const [payloadBase64, signatureBase64] = cursor.split(".");

    expectAppError(() => decodeCursor(`${payloadBase64}.${signatureBase64}!!`));
  });

  it("rejects a payload containing invalid Base64URL characters", () => {
    const cursor = createValidCursor();
    const [payloadBase64] = cursor.split(".");

    const malformedCursor = createSignedCursorFromPayloadBase64(
      `${payloadBase64}!`
    );

    expectAppError(() => decodeCursor(malformedCursor));
  });

  it("rejects a signature with a noncanonical Base64URL representation", () => {
    const cursor = createValidCursor();
    const [payloadBase64, signatureBase64] = cursor.split(".");

    const noncanonicalSignature = makeNonCanonicalBase64Url(signatureBase64);

    // The representation differs, but the decoded bytes are identical.
    expect(noncanonicalSignature).not.toBe(signatureBase64);

    expect(Buffer.from(noncanonicalSignature, "base64url")).toEqual(
      Buffer.from(signatureBase64, "base64url")
    );

    expectAppError(() =>
      decodeCursor(`${payloadBase64}.${noncanonicalSignature}`)
    );
  });

  it("rejects a payload with a noncanonical Base64URL representation", () => {
    const cursor = createSignedCursorWithNoncanonicalPayload({
      ...createValidPayload(),
      v: CURSOR_VERSION,
    });

    expectAppError(() => decodeCursor(cursor));
  });

  it("rejects a Base64URL signature with an invalid encoded length", () => {
    const cursor = createValidCursor();
    const [payloadBase64] = cursor.split(".");

    // "A" uses a permitted Base64URL character,
    // but is not a canonical Base64URL representation.
    expectAppError(() => decodeCursor(`${payloadBase64}.A`));
  });

  it("rejects a cursor signed with a different secret", () => {
    const cursor = createSignedCursorFromJson(
      JSON.stringify({
        ...createValidPayload(),
        v: CURSOR_VERSION,
      }),
      OTHER_SECRET
    );

    expectAppError(() => decodeCursor(cursor));
  });

  it("rejects correctly signed data that is not valid JSON", () => {
    const cursor = createSignedCursorFromJson("{invalid-json");

    expectAppError(() => decodeCursor(cursor));
  });

  it.each([
    { label: "null", json: "null" },
    { label: "an array", json: "[]" },
    { label: "a string", json: '"cursor"' },
    { label: "a number", json: "123" },
    { label: "a boolean", json: "true" },
  ])("rejects a correctly signed payload containing $label", ({ json }) => {
    const cursor = createSignedCursorFromJson(json);

    expectAppError(() => decodeCursor(cursor));
  });

  it("rejects a payload without a version", () => {
    const payload = createValidPayload();
    delete payload.v;

    const cursor = createSignedCursorFromJson(JSON.stringify(payload));

    expectAppError(() => decodeCursor(cursor));
  });

  it("rejects a payload with an unsupported cursor version", () => {
    const cursor = createSignedCursorFromJson(
      JSON.stringify({
        ...createValidPayload(),
        v: "unsupported-version",
      })
    );

    expectAppError(() => decodeCursor(cursor));
  });

  // --------------------------------------------------------------------------
  // Missing secret is an internal server error
  // --------------------------------------------------------------------------

  it("reports a missing cursor secret as an internal server error", () => {
    const cursor = createValidCursor();

    vi.stubEnv("CURSOR_SECRET", "");

    expectAppError(
      () => decodeCursor(cursor),
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      500
    );
  });
});

// ============================================================================
// normalizeCreatedAtIdCursor
// ============================================================================

describe("normalizeCreatedAtIdCursor", () => {
  it("converts a valid cursor payload into a Date and ObjectId", () => {
    const result = normalizeCreatedAtIdCursor({
      createdAt: VALID_CREATED_AT,
      id: VALID_ID,
    });

    expect(result).toEqual({
      createdAt: new Date(VALID_CREATED_AT),
      id: new mongoose.Types.ObjectId(VALID_ID),
    });

    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.id).toBeInstanceOf(mongoose.Types.ObjectId);
    expect(result.id.toString()).toBe(VALID_ID);
  });

  it("accepts a valid uppercase hexadecimal ObjectId", () => {
    const uppercaseId = VALID_ID.toUpperCase();

    const result = normalizeCreatedAtIdCursor({
      createdAt: VALID_CREATED_AT,
      id: uppercaseId,
    });

    expect(result.id).toBeInstanceOf(mongoose.Types.ObjectId);
    expect(result.id.toString()).toBe(VALID_ID);
  });

  it.each([
    { label: "null", payload: null },
    { label: "undefined", payload: undefined },
    { label: "a string", payload: "invalid" },
    { label: "a number", payload: 123 },
    { label: "an array", payload: [] },
  ])("rejects $label as a payload", ({ payload }) => {
    expectAppError(() => normalizeCreatedAtIdCursor(payload));
  });

  it.each([
    { label: "missing", createdAt: undefined },
    { label: "null", createdAt: null },
    { label: "a number", createdAt: 123 },
    {
      label: "a Date object",
      createdAt: new Date(VALID_CREATED_AT),
    },
  ])("rejects a createdAt value that is $label", ({ createdAt }) => {
    expectAppError(() =>
      normalizeCreatedAtIdCursor({
        createdAt,
        id: VALID_ID,
      })
    );
  });

  it("rejects a custom class instance even when it has valid cursor fields", () => {
    class CursorPayload {
      constructor() {
        this.createdAt = VALID_CREATED_AT;
        this.id = VALID_ID;
      }
    }

    expectAppError(() => normalizeCreatedAtIdCursor(new CursorPayload()));
  });

  it.each([
    "invalid-date",
    "2026-01-02",
    "2026-01-02T03:04:05Z",
    "2026-02-30T00:00:00.000Z",
  ])("rejects a noncanonical or invalid ISO date: %s", (createdAt) => {
    expectAppError(() =>
      normalizeCreatedAtIdCursor({
        createdAt,
        id: VALID_ID,
      })
    );
  });

  it.each([
    { label: "missing", id: undefined },
    { label: "null", id: null },
    { label: "a number", id: 123 },
    {
      label: "an ObjectId instance",
      id: new mongoose.Types.ObjectId(),
    },
    { label: "an object", id: {} },
  ])("rejects an ID that is $label", ({ id }) => {
    expectAppError(() =>
      normalizeCreatedAtIdCursor({
        createdAt: VALID_CREATED_AT,
        id,
      })
    );
  });

  // --------------------------------------------------------------------------
  // Invalid IDs in cursors use INVALID_CURSOR
  // --------------------------------------------------------------------------

  it("rejects a malformed ObjectId string as an invalid cursor", () => {
    expectAppError(() =>
      normalizeCreatedAtIdCursor({
        createdAt: VALID_CREATED_AT,
        id: "invalid-object-id",
      })
    );
  });
});
