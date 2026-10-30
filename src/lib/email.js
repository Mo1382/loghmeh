import "server-only";

import { Resend } from "resend";

import { getServerEnv } from "@/lib/config/env";

import { isValidEmail } from "@/lib/validation/isValidEmail";

const { RESEND_API_KEY, RESEND_FROM_EMAIL } = getServerEnv();

const resend = new Resend(RESEND_API_KEY);

const HTML_ENTITIES = Object.freeze({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
});

/**
 * Escape HTML special characters.
 */
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    return HTML_ENTITIES[character];
  });
}

/**
 * Send an authentication code email.
 */
async function sendAuthCodeEmail({
  to,
  code,
  subject,
  preheader,
  heading,
  description,
  expiresInMinutes,
}) {
  if (!isValidEmail(to)) {
    throw new TypeError("to must be a valid email address.");
  }

  const recipient = to.trim();

  if (
    typeof code !== "string" ||
    code.length !== 6 ||
    !/^[0-9]{6}$/.test(code)
  ) {
    throw new TypeError("code must contain exactly six ASCII digits.");
  }

  if (!Number.isSafeInteger(expiresInMinutes) || expiresInMinutes <= 0) {
    throw new TypeError("expiresInMinutes must be a positive safe integer.");
  }

  if (typeof preheader !== "string" || !preheader.trim()) {
    throw new TypeError("preheader must be a non-empty string.");
  }

  if (typeof heading !== "string" || !heading.trim()) {
    throw new TypeError("heading must be a non-empty string.");
  }

  if (typeof description !== "string" || !description.trim()) {
    throw new TypeError("description must be a non-empty string.");
  }

  if (typeof subject !== "string" || !subject.trim()) {
    throw new TypeError("subject must be a non-empty string.");
  }

  const safePreheader = escapeHtml(preheader);
  const safeHeading = escapeHtml(heading);
  const safeDescription = escapeHtml(description);
  const safeCode = escapeHtml(code);

  const text = [
    heading,
    "",
    description,
    "",
    `کد شما: ${code}`,
    "",
    `این کد تا ${expiresInMinutes} دقیقه معتبر است.`,
    "اگر این درخواست را شما انجام نداده‌اید، این ایمیل را نادیده بگیرید.",
  ].join("\n");

  const html = `
    <!doctype html>
    <html lang="fa" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${safeHeading}</title>
      </head>

      <body style="
        margin:0;
        padding:0;
        font-family:Tahoma,Arial,sans-serif;
        color:#222;
        line-height:1.8;
        background-color:#f5f5f5;
      ">

        <!-- Preheader -->
        <div
          style="
            display:none !important;
            visibility:hidden;
            opacity:0;
            color:transparent;
            height:0;
            width:0;
            max-height:0;
            max-width:0;
            overflow:hidden;
            mso-hide:all;
          "
        >${safePreheader}</div>

        <!-- Main email content -->
        <table
          role="presentation"
          width="100%"
          cellspacing="0"
          cellpadding="0"
          border="0"
        >
          <tr>
            <td align="center" style="padding:24px 12px">

              <table
                role="presentation"
                width="520"
                cellspacing="0"
                cellpadding="0"
                border="0"
                style="
                  width:100%;
                  max-width:520px;
                  background-color:#ffffff;
                  border-radius:12px;
                "
              >
                <tr>
                  <td style="padding:28px 24px">

                    <h1 style="font-size:24px;margin:0 0 20px">
                      لقمه
                    </h1>

                    <h2 style="font-size:20px;margin:0 0 12px">
                      ${safeHeading}
                    </h2>

                    <p style="margin:0 0 24px">
                      ${safeDescription}
                    </p>

                    <table
                      role="presentation"
                      width="100%"
                      cellspacing="0"
                      cellpadding="0"
                      border="0"
                    >
                      <tr>
                        <td
                          dir="ltr"
                          align="center"
                          style="
                            padding:16px;
                            font-size:32px;
                            font-weight:bold;
                            letter-spacing:8px;
                            background-color:#f5f5f5;
                            border-radius:8px;
                          "
                        >
                          ${safeCode}
                        </td>
                      </tr>
                    </table>

                    <p style="margin:24px 0 12px">
                      این کد تا ${expiresInMinutes} دقیقه معتبر است.
                    </p>

                    <p style="font-size:13px;color:#666;margin:0">
                      اگر این درخواست را شما انجام نداده‌اید،
                      این ایمیل را نادیده بگیرید.
                    </p>

                  </td>
                </tr>
              </table>

            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  const { data, error } = await resend.emails.send({
    from: RESEND_FROM_EMAIL,
    to: [recipient],
    subject,
    html,
    text,
  });

  if (error) {
    throw new Error("Resend could not send the email.", {
      cause: error,
    });
  }

  if (typeof data?.id !== "string" || data.id.trim().length === 0) {
    throw new Error("Resend did not return an email ID.");
  }

  return { id: data.id };
}

/**
 * Send an email verification code.
 */
export function sendVerificationCodeEmail({ to, code, expiresInMinutes = 10 }) {
  return sendAuthCodeEmail({
    to,
    code,
    subject: "کد تأیید ایمیل لقمه",
    preheader: "کد شش‌ رقمی تأیید ایمیل شما در لقمه آماده است.",
    heading: "تأیید ایمیل",
    description: "برای تأیید نشانی ایمیل خود در لقمه، کد زیر را وارد کنید.",
    expiresInMinutes,
  });
}

/**
 * Send a password reset code.
 */
export function sendPasswordResetCodeEmail({
  to,
  code,
  expiresInMinutes = 10,
}) {
  return sendAuthCodeEmail({
    to,
    code,
    subject: "کد بازیابی رمز عبور لقمه",
    preheader:
      "برای بازیابی رمز عبور خود در لقمه، از کد یک‌بار مصرف استفاده کنید.",
    heading: "بازیابی رمز عبور",
    description: "برای بازیابی رمز عبور خود در لقمه، کد زیر را وارد کنید.",
    expiresInMinutes,
  });
}
