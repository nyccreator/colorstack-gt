import { v } from "convex/values";

import { internalAction } from "./_generated/server";
import { OTP_EXPIRY_SECONDS } from "./lib/config";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

function isDevelopment(): boolean {
  try {
    const { hostname } = new URL(process.env.SITE_URL ?? "");
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

const body = (code: string) =>
  [
    `Your ColorStack at Georgia Tech code is ${code}.`,
    "",
    `Enter it on the page you asked for it from. It expires in ${OTP_EXPIRY_SECONDS / 60} minutes.`,
    "If you did not ask for a code, you can ignore this email.",
  ].join("\n");

export const sendCode = internalAction({
  args: { email: v.string(), code: v.string() },
  handler: async (_ctx, { email, code }) => {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;

    if (!apiKey || !from) {
      if (!isDevelopment()) {
        throw new Error(
          `No mail provider configured on ${process.env.SITE_URL}. Set RESEND_API_KEY and EMAIL_FROM on this deployment. Sign-in codes are never written to its logs.`,
        );
      }
      console.info(`No mail provider configured. Sign-in code for ${email}: ${code}`);
      return;
    }

    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: email,
        subject: `${code} is your ColorStack at Georgia Tech code`,
        text: body(code),
      }),
    });

    if (!response.ok) {
      throw new Error(`Resend rejected the message: ${response.status} ${await response.text()}`);
    }
  },
});
