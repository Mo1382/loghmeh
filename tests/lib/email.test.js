import { beforeEach, describe, expect, it, vi } from "vitest";

const { resendSendMock, ResendMock, getServerEnvMock } = vi.hoisted(() => {
  const resendSendMock = vi.fn();

  const ResendMock = vi.fn(function ResendMock(apiKey) {
    this.apiKey = apiKey;

    this.emails = {
      send: resendSendMock,
    };
  });

  const getServerEnvMock = vi.fn(() => ({
    RESEND_API_KEY: "re_test_api_key",
    RESEND_FROM_EMAIL: "no-reply@loghmeh.test",
  }));

  return {
    resendSendMock,
    ResendMock,
    getServerEnvMock,
  };
});

vi.mock("server-only", () => ({}));

vi.mock("resend", () => ({
  Resend: ResendMock,
}));

vi.mock("@/lib/config/env", () => ({
  getServerEnv: getServerEnvMock,
}));

import {
  sendPasswordResetCodeEmail,
  sendVerificationCodeEmail,
} from "@/lib/email";

// Capture initialization calls before Vitest clears mocks.
const resendInitialization = {
  apiKeys: ResendMock.mock.calls.map(([apiKey]) => apiKey),
  envCalls: getServerEnvMock.mock.calls.length,
};

const VALID_EMAIL = "user@example.com";
const VALID_CODE = "123456";
const EMAIL_ID = "email_test_123";
const DEFAULT_EXPIRY_MINUTES = 10;

const EMAIL_SCENARIOS = [
  {
    name: "verification",
    send: sendVerificationCodeEmail,
    subject: "کد تأیید ایمیل لقمه",
    preheader: "کد شش‌رقمی تأیید ایمیل شما در لقمه آماده است.",
    heading: "تأیید ایمیل",
    description: "برای تأیید نشانی ایمیل خود در لقمه، کد زیر را وارد کنید.",
  },
  {
    name: "password reset",
    send: sendPasswordResetCodeEmail,
    subject: "کد بازنشانی رمز عبور لقمه",
    preheader:
      "برای بازنشانی رمز عبور خود در لقمه، از کد یک‌بارمصرف استفاده کنید.",
    heading: "بازنشانی رمز عبور",
    description: "برای بازنشانی رمز عبور خود در لقمه، کد زیر را وارد کنید.",
  },
];

beforeEach(() => {
  resendSendMock.mockReset();

  resendSendMock.mockResolvedValue({
    data: { id: EMAIL_ID },
    error: null,
  });
});

describe("Resend initialization", () => {
  it("initializes Resend with the server API key", () => {
    expect(resendInitialization).toEqual({
      apiKeys: ["re_test_api_key"],
      envCalls: 1,
    });
  });
});

describe.each(EMAIL_SCENARIOS)("$name email", (scenario) => {
  const { send, subject, preheader, heading, description } = scenario;

  it("sends the email with the correct Resend payload", async () => {
    const result = await send({
      to: ` ${VALID_EMAIL} `,
      code: VALID_CODE,
      expiresInMinutes: 7,
    });

    expect(result).toEqual({ id: EMAIL_ID });

    expect(resendSendMock).toHaveBeenCalledOnce();

    const [payload] = resendSendMock.mock.calls[0];

    expect(payload).toEqual({
      from: "no-reply@loghmeh.test",
      to: [VALID_EMAIL],
      subject,
      html: expect.any(String),
      text: expect.any(String),
    });

    // HTML content
    expect(payload.html).toContain("<!doctype html>");
    expect(payload.html).toContain('lang="fa" dir="rtl"');
    expect(payload.html).toContain("لقمه");
    expect(payload.html).toContain(heading);
    expect(payload.html).toContain(description);
    expect(payload.html).toContain(preheader);
    expect(payload.html).toContain(VALID_CODE);

    // Direction of the verification code
    expect(payload.html).toContain('dir="ltr"');
    expect(payload.html).toContain('align="center"');

    // Expiration time
    expect(payload.html).toContain("این کد تا 7 دقیقه معتبر است.");

    // Text fallback
    expect(payload.text).toBe(
      [
        heading,
        "",
        description,
        "",
        `کد شما: ${VALID_CODE}`,
        "",
        "این کد تا 7 دقیقه معتبر است.",
        "اگر این درخواست را شما انجام نداده‌اید، این ایمیل را نادیده بگیرید.",
      ].join("\n")
    );
  });

  it("uses the default expiration time when it is omitted", async () => {
    await send({
      to: VALID_EMAIL,
      code: VALID_CODE,
    });

    const [payload] = resendSendMock.mock.calls[0];

    expect(payload.html).toContain(
      `این کد تا ${DEFAULT_EXPIRY_MINUTES} دقیقه معتبر است.`
    );

    expect(payload.text).toContain(
      `این کد تا ${DEFAULT_EXPIRY_MINUTES} دقیقه معتبر است.`
    );
  });

  it.each([
    ["an invalid email", "invalid-email"],
    ["an empty string", ""],
    ["a whitespace-only string", "   "],
    ["null", null],
    ["undefined", undefined],
    ["a number", 123],
    ["an object", {}],
  ])("rejects %s as an invalid recipient", async (_label, to) => {
    await expect(
      send({
        to,
        code: VALID_CODE,
      })
    ).rejects.toThrow("to must be a valid email address.");

    expect(resendSendMock).not.toHaveBeenCalled();
  });
});

describe("input validation", () => {
  it.each([
    ["undefined", undefined],
    ["null", null],
    ["a number", 123456],
    ["an empty string", ""],
    ["a five-digit code", "12345"],
    ["a seven-digit code", "1234567"],
    ["a code containing letters", "12ab56"],
    ["a code containing Persian digits", "۱۲۳۴۵۶"],
    ["a code containing full-width digits", "１２３４５６"],
    ["a code containing special characters", "12345!"],
  ])("rejects %s as an invalid verification code", async (_label, code) => {
    await expect(
      sendVerificationCodeEmail({
        to: VALID_EMAIL,
        code,
      })
    ).rejects.toThrow("code must contain exactly six ASCII digits.");

    expect(resendSendMock).not.toHaveBeenCalled();
  });

  it.each([
    ["zero", 0],
    ["a negative number", -1],
    ["a decimal number", 1.5],
    ["NaN", Number.NaN],
    ["Infinity", Infinity],
    ["a value above the safe integer limit", Number.MAX_SAFE_INTEGER + 1],
    ["a string", "10"],
    ["null", null],
  ])(
    "rejects %s as an invalid expiration time",
    async (_label, expiresInMinutes) => {
      await expect(
        sendVerificationCodeEmail({
          to: VALID_EMAIL,
          code: VALID_CODE,
          expiresInMinutes,
        })
      ).rejects.toThrow("expiresInMinutes must be a positive safe integer.");

      expect(resendSendMock).not.toHaveBeenCalled();
    }
  );
});

describe("Resend response handling", () => {
  it("wraps a Resend API error and preserves its cause", async () => {
    const providerError = {
      name: "validation_error",
      code: "invalid_from",
      statusCode: 422,
      message: "Invalid sender address.",
    };

    resendSendMock.mockResolvedValueOnce({
      data: null,
      error: providerError,
    });

    await expect(
      sendVerificationCodeEmail({
        to: VALID_EMAIL,
        code: VALID_CODE,
      })
    ).rejects.toMatchObject({
      name: "Error",
      message: "Resend could not send the email.",
      cause: providerError,
    });

    expect(resendSendMock).toHaveBeenCalledOnce();
  });

  it.each([
    ["undefined data", undefined],
    ["null data", null],
    ["an empty response object", {}],
    ["a malformed response object", { unexpected: true }],
    ["an empty ID", { id: "" }],
    ["a whitespace-only ID", { id: "   " }],
    ["a null ID", { id: null }],
    ["a numeric ID", { id: 123 }],
    ["an object ID", { id: {} }],
    ["an array ID", { id: [] }],
    ["a boolean ID", { id: true }],
  ])("throws an error when Resend returns %s", async (_label, data) => {
    resendSendMock.mockResolvedValueOnce({
      data,
      error: null,
    });

    await expect(
      sendVerificationCodeEmail({
        to: VALID_EMAIL,
        code: VALID_CODE,
      })
    ).rejects.toThrow("Resend did not return an email ID.");

    expect(resendSendMock).toHaveBeenCalledOnce();
  });

  it("propagates an unexpected error thrown by the Resend SDK", async () => {
    const sdkError = new Error("Network connection failed.");

    resendSendMock.mockRejectedValueOnce(sdkError);

    await expect(
      sendVerificationCodeEmail({
        to: VALID_EMAIL,
        code: VALID_CODE,
      })
    ).rejects.toBe(sdkError);
  });
});
