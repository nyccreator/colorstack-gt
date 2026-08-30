import { v } from "convex/values";

import { internalAction } from "./_generated/server";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

const body = (url: string) =>
  [
    "Click the link below to sign in to ColorStack at Georgia Tech.",
    "",
    url,
    "",
    "The link expires in 15 minutes and works once.",
    "If you did not ask for it, you can ignore this email.",
  ].join("\n");

export const sendMagicLink = internalAction({
  args: { email: v.string(), url: v.string() },
  handler: async (_ctx, { email, url }) => {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;

    if (!apiKey || !from) {
      console.info(`No mail provider configured. Magic link for ${email}: ${url}`);
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
        subject: "Your ColorStack at Georgia Tech sign-in link",
        text: body(url),
      }),
    });

    if (!response.ok) {
      throw new Error(`Resend rejected the message: ${response.status} ${await response.text()}`);
    }
  },
});
