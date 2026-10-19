import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { requireRunMutationCtx } from "@convex-dev/better-auth/utils";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { emailOTP } from "better-auth/plugins/email-otp";
import { betterAuth } from "better-auth/minimal";
import { v } from "convex/values";

import { components, internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { internalMutation } from "./_generated/server";
import authConfig from "./auth.config";
import { OTP_ALLOWED_ATTEMPTS, OTP_EXPIRY_SECONDS, OTP_LENGTH, OTP_RATE_LIMIT } from "./lib/config";
import { isGeorgiaTechEmail, normalizeEmail } from "./lib/identity";

const siteUrl = process.env.SITE_URL!;

const SEND = "/email-otp/send-verification-otp";
const SIGN_IN = "/sign-in/email-otp";
const UNUSED = [
  "/email-otp/check-verification-otp",
  "/email-otp/verify-email",
  "/email-otp/request-password-reset",
  "/forget-password/email-otp",
  "/email-otp/reset-password",
  "/email-otp/request-email-change",
  "/email-otp/change-email",
];

export const authComponent = createClient<DataModel>(components.betterAuth);

export const allowCode = internalMutation({
  args: { email: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { email }) => {
    const row = await ctx.db
      .query("codeSends")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    const now = Date.now();
    const recent = (row?.sentAt ?? []).filter((at) => at > now - OTP_RATE_LIMIT.window * 1000);
    if (recent.length >= OTP_RATE_LIMIT.max) return false;

    const sentAt = [...recent, now];
    if (row) await ctx.db.patch(row._id, { sentAt });
    else await ctx.db.insert("codeSends", { email, sentAt });
    return true;
  },
});

function createAuth(ctx: GenericCtx<DataModel>) {
  return betterAuth({
    baseURL: siteUrl,
    trustedOrigins: [siteUrl],
    database: authComponent.adapter(ctx),
    disabledPaths: UNUSED,
    // Better Auth limits by client IP, which the site's auth proxy hides, so codes are limited per address in allowCode instead.
    rateLimit: { enabled: false },
    // Refusals live here because Better Auth swallows anything sendVerificationOTP throws and still answers 200.
    hooks: {
      before: createAuthMiddleware(async (c) => {
        if (c.path !== SEND && c.path !== SIGN_IN) return;
        const email = c.body?.email;
        if (typeof email !== "string" || !isGeorgiaTechEmail(email)) {
          throw APIError.fromStatus("BAD_REQUEST", { message: "Use your @gatech.edu email." });
        }
        if (c.path === SIGN_IN) return;
        if (c.body.type !== "sign-in") {
          throw APIError.fromStatus("BAD_REQUEST", { message: "Only sign-in codes are sent." });
        }

        const allowed = await requireRunMutationCtx(ctx).runMutation(internal.auth.allowCode, {
          email: normalizeEmail(email),
        });
        if (!allowed) {
          throw APIError.fromStatus("TOO_MANY_REQUESTS", {
            message: "Too many codes requested. Wait a minute and try again.",
          });
        }
      }),
    },
    plugins: [
      emailOTP({
        otpLength: OTP_LENGTH,
        expiresIn: OTP_EXPIRY_SECONDS,
        allowedAttempts: OTP_ALLOWED_ATTEMPTS,
        storeOTP: "hashed",
        sendVerificationOTP: async ({ email, otp }) => {
          await requireRunMutationCtx(ctx).scheduler.runAfter(0, internal.email.sendCode, {
            email,
            code: otp,
          });
        },
      }),
      convex({ authConfig, jwksRotateOnTokenGenerationError: true }),
    ],
  });
}

export { createAuth };
