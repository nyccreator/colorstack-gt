import { type AuthFunctions, createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { requireRunMutationCtx } from "@convex-dev/better-auth/utils";
import { magicLink } from "better-auth/plugins/magic-link";
import { betterAuth } from "better-auth/minimal";

import { components, internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import authConfig from "./auth.config";
import { MAGIC_LINK_EXPIRY_SECONDS, MAGIC_LINK_RATE_LIMIT } from "./lib/config";
import { isGeorgiaTechEmail, normalizeEmail } from "./lib/identity";

const siteUrl = process.env.SITE_URL!;

export const authComponent = createClient<DataModel>(components.betterAuth, {
  authFunctions: internal.auth as AuthFunctions,
  triggers: {
    user: {
      onCreate: async (ctx, user) => {
        const member = await ctx.db
          .query("members")
          .withIndex("by_gtEmail", (q) => q.eq("gtEmail", normalizeEmail(user.email)))
          .unique();

        if (!member) return;

        await ctx.db.patch(member._id, { userId: user._id, verifiedAt: Date.now() });
      },
    },
  },
});

export const { onCreate, onUpdate, onDelete } = authComponent.triggersApi();

function createAuth(ctx: GenericCtx<DataModel>) {
  return betterAuth({
    baseURL: siteUrl,
    trustedOrigins: [siteUrl],
    database: authComponent.adapter(ctx),
    plugins: [
      magicLink({
        expiresIn: MAGIC_LINK_EXPIRY_SECONDS,
        rateLimit: MAGIC_LINK_RATE_LIMIT,
        sendMagicLink: async ({ email, token }) => {
          if (!isGeorgiaTechEmail(email)) return;

          await requireRunMutationCtx(ctx).scheduler.runAfter(0, internal.email.sendMagicLink, {
            email,
            url: `${siteUrl}/auth/verify?token=${encodeURIComponent(token)}`,
          });
        },
      }),
      convex({ authConfig, jwksRotateOnTokenGenerationError: true }),
    ],
  });
}

export { createAuth };
