import { ConvexError, type Infer, v } from "convex/values";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalMutation, internalQuery, query } from "./_generated/server";
import { authComponent, createAuth } from "./auth";
import { RESUME_SWEEP_BATCH, RESUME_UPLOAD_TTL_MS } from "./lib/config";
import { isGraduationYearAllowed } from "./lib/graduation";
import { isGeorgiaTechEmail, isPhone, normalizeEmail } from "./lib/identity";
import { demographicAnswers, registrationFields } from "./schema";

const outcome = v.union(v.literal("saved"), v.literal("exists"));

type Outcome = Infer<typeof outcome>;

const submission = {
  ...registrationFields,
  resumeUploadToken: v.optional(v.string()),
  demographics: v.object(demographicAnswers),
};

/** Whether any member row already uses this address, confirmed or not. */
export const exists = internalQuery({
  args: { gtEmail: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const member = await ctx.db
      .query("members")
      .withIndex("by_gtEmail", (q) => q.eq("gtEmail", args.gtEmail))
      .unique();
    return member !== null;
  },
});

/**
 * Starts a sign up. Emails a sign in link if the address is already taken,
 * otherwise reports that the form should be filled in.
 */
export const start = action({
  args: { gtEmail: v.string() },
  returns: v.union(v.literal("register"), v.literal("link_sent")),
  handler: async (ctx, args) => {
    const gtEmail = normalizeEmail(args.gtEmail);

    if (!isGeorgiaTechEmail(gtEmail)) {
      throw new ConvexError("Enter a Georgia Tech email address.");
    }

    if (!(await ctx.runQuery(internal.members.exists, { gtEmail }))) {
      return "register";
    }

    const { auth, headers } = await authComponent.getAuth(createAuth, ctx);
    await auth.api.signInMagicLink({ body: { email: gtEmail, callbackURL: "/portal" }, headers });
    return "link_sent";
  },
});

export const me = query({
  args: {},
  returns: v.union(v.object({ firstName: v.string() }), v.null()),
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return null;

    const member =
      (await ctx.db
        .query("members")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .unique()) ??
      (await ctx.db
        .query("members")
        .withIndex("by_gtEmail", (q) => q.eq("gtEmail", normalizeEmail(user.email)))
        .unique());

    return member ? { firstName: member.firstName } : null;
  },
});

/** Records a stored file as unclaimed so a registration can claim it later. */
export const recordUpload = internalMutation({
  args: { token: v.string(), storageId: v.id("_storage") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("resumeUploads", {
      ...args,
      expiresAt: Date.now() + RESUME_UPLOAD_TTL_MS,
    });
    return null;
  },
});

/** Writes a registration, unless the address belongs to a confirmed member. */
export const saveSubmission = internalMutation({
  args: submission,
  returns: outcome,
  handler: async (ctx, { demographics, resumeUploadToken, ...member }) => {
    const pending = resumeUploadToken
      ? await ctx.db
          .query("resumeUploads")
          .withIndex("by_token", (q) => q.eq("token", resumeUploadToken))
          .unique()
      : null;

    if (pending) await ctx.db.delete(pending._id);
    const resume = pending && pending.expiresAt > Date.now() ? pending.storageId : undefined;
    if (pending && !resume) await ctx.storage.delete(pending.storageId);

    const existing = await ctx.db
      .query("members")
      .withIndex("by_gtEmail", (q) => q.eq("gtEmail", member.gtEmail))
      .unique();

    if (existing && existing.verifiedAt !== undefined) {
      if (resume) await ctx.storage.delete(resume);
      return "exists";
    }

    if (existing) {
      if (existing.resumeStorageId && resume) {
        await ctx.storage.delete(existing.resumeStorageId);
      }
      await ctx.db.replace(existing._id, {
        ...member,
        role: existing.role,
        resumeStorageId: resume ?? existing.resumeStorageId,
      });
      const previous = await ctx.db
        .query("demographics")
        .withIndex("by_member", (q) => q.eq("memberId", existing._id))
        .unique();
      if (previous) await ctx.db.delete(previous._id);
      await ctx.db.insert("demographics", { ...demographics, memberId: existing._id });
      return "saved";
    }

    const memberId: Id<"members"> = await ctx.db.insert("members", {
      ...member,
      role: "member",
      resumeStorageId: resume,
    });
    await ctx.db.insert("demographics", { ...demographics, memberId });
    return "saved";
  },
});

/** Deletes expired uploads and their files, returning how many it removed. */
export const sweepUnclaimedResumes = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const stale = await ctx.db
      .query("resumeUploads")
      .withIndex("by_expiresAt", (q) => q.lt("expiresAt", Date.now()))
      .take(RESUME_SWEEP_BATCH);

    for (const upload of stale) {
      await ctx.storage.delete(upload.storageId);
      await ctx.db.delete(upload._id);
    }
    return stale.length;
  },
});

/** Validates a registration, saves it, and emails a sign in link. */
export const register = action({
  args: submission,
  returns: outcome,
  handler: async (ctx, args): Promise<Outcome> => {
    const gtEmail = normalizeEmail(args.gtEmail);

    if (!isGeorgiaTechEmail(gtEmail)) {
      throw new ConvexError("Enter a Georgia Tech email address.");
    }
    if (normalizeEmail(args.personalEmail) === gtEmail) {
      throw new ConvexError("Use a personal email other than your Georgia Tech address.");
    }
    if (!isPhone(args.phone)) {
      throw new ConvexError("Enter a valid phone number.");
    }
    if (!isGraduationYearAllowed(args.graduationYear)) {
      throw new ConvexError("Choose a graduation year within four years of today.");
    }

    const result: Outcome = await ctx.runMutation(internal.members.saveSubmission, {
      ...args,
      gtEmail,
    });

    const { auth, headers } = await authComponent.getAuth(createAuth, ctx);
    await auth.api.signInMagicLink({
      body: {
        email: gtEmail,
        name: `${args.firstName} ${args.lastName}`.trim(),
        callbackURL: "/portal",
      },
      headers,
    });

    return result;
  },
});
