import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { requireRunMutationCtx } from "@convex-dev/better-auth/utils";
import { emailOTP } from "better-auth/plugins/email-otp";
import { betterAuth } from "better-auth/minimal";

import { components, internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import authConfig from "./auth.config";
import { OTP_ALLOWED_ATTEMPTS, OTP_EXPIRY_SECONDS, OTP_LENGTH, OTP_RATE_LIMIT } from "./lib/config";
import { isGeorgiaTechEmail } from "./lib/identity";

const siteUrl = process.env.SITE_URL!;

export const authComponent = createClient<DataModel>(components.betterAuth);

function createAuth(ctx: GenericCtx<DataModel>) {
  return betterAuth({
    baseURL: siteUrl,
    trustedOrigins: [siteUrl],
    database: authComponent.adapter(ctx),
    plugins: [
      emailOTP({
        otpLength: OTP_LENGTH,
        expiresIn: OTP_EXPIRY_SECONDS,
        allowedAttempts: OTP_ALLOWED_ATTEMPTS,
        rateLimit: OTP_RATE_LIMIT,
        storeOTP: "hashed",
        sendVerificationOTP: async ({ email, otp }) => {
          if (!isGeorgiaTechEmail(email)) {
            throw new Error("Accounts are for Georgia Tech students.");
          }

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
