import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  mutation,
  type MutationCtx,
  query,
  type QueryCtx,
} from "./_generated/server";
import { authComponent } from "./auth";
import { TEXT_MAX_LENGTH } from "./lib/config";
import { soleRace } from "./lib/demographics";
import { isGraduationYearAllowed } from "./lib/graduation";
import { isComplete, savedGroups, stepOf } from "./lib/groups";
import {
  personalEmailError,
  isPhone,
  normalizeEmail,
  profileError,
  type ProfileSite,
  profileUrl,
} from "./lib/identity";
import { MESSAGES } from "./lib/messages";
import {
  contactFields,
  demographicAnswers,
  groupFlags,
  interestFields,
  materialsFields,
  memberGroups,
  nameFields,
  optionalGroup,
  studiesFields,
  task,
} from "./schema";

function findMember(ctx: QueryCtx, userId: string) {
  return ctx.db
    .query("members")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
}

function findDemographics(ctx: QueryCtx, memberId: Id<"members">) {
  return ctx.db
    .query("demographics")
    .withIndex("by_member", (q) => q.eq("memberId", memberId))
    .unique();
}

async function ownRow(ctx: MutationCtx): Promise<Doc<"members">> {
  const user = await authComponent.safeGetAuthUser(ctx);
  if (!user) throw new ConvexError(MESSAGES.signIn);

  const existing = await findMember(ctx, user._id);
  if (existing) return existing;

  const id = await ctx.db.insert("members", { userId: user._id, step: 0, tasksDone: [] });
  return (await ctx.db.get(id))!;
}

function withinLimit(args: Record<string, unknown>) {
  for (const value of Object.values(args)) {
    if (typeof value === "string" && value.length > TEXT_MAX_LENGTH) {
      throw new ConvexError(MESSAGES.tooLong);
    }
  }
}

function required(value: string, message: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new ConvexError(message);
  return trimmed;
}

function profileLink(site: ProfileSite, value = ""): string | undefined {
  const error = profileError(site, value);
  if (error) throw new ConvexError(error);
  return profileUrl(site, value);
}

const profile = v.object({
  gtEmail: v.string(),
  ...memberGroups,
  resume: v.optional(v.object({ name: v.string(), size: v.number() })),
  saved: groupFlags,
  onRoster: v.boolean(),
  complete: v.boolean(),
  joinedAt: v.optional(v.number()),
});

export const me = query({
  args: {},
  returns: v.union(profile, v.null()),
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return null;

    const member = await findMember(ctx, user._id);
    const reported = member ? (await findDemographics(ctx, member._id)) !== null : false;
    const gtEmail = normalizeEmail(user.email);
    const onRoster =
      (await ctx.db
        .query("roster")
        .withIndex("by_email", (q) => q.eq("email", gtEmail))
        .first()) !== null;
    const saved = savedGroups(member, reported);

    return {
      gtEmail,
      name: member?.name,
      contact: member?.contact,
      studies: member?.studies,
      materials: member?.materials,
      interests: member?.interests,
      resume: member?.resume && { name: member.resume.name, size: member.resume.size },
      saved,
      onRoster,
      complete: isComplete(saved),
      joinedAt: member?._creationTime,
    };
  },
});

export const resumeUrl = query({
  args: {},
  returns: v.union(v.string(), v.null()),
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return null;

    const member = await findMember(ctx, user._id);
    return member?.resume ? await ctx.storage.getUrl(member.resume.storageId) : null;
  },
});

export const myDemographics = query({
  args: {},
  returns: v.union(v.object(demographicAnswers), v.null()),
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return null;

    const member = await findMember(ctx, user._id);
    const row = member && (await findDemographics(ctx, member._id));
    if (!row) return null;

    const { raceEthnicity, gender, firstGeneration, lowIncome } = row;
    return { raceEthnicity, gender, firstGeneration, lowIncome };
  },
});

export const saveName = mutation({
  args: nameFields,
  returns: v.null(),
  handler: async (ctx, args) => {
    withinLimit(args);
    const name = {
      firstName: required(args.firstName, MESSAGES.firstName),
      lastName: required(args.lastName, MESSAGES.lastName),
      pronouns: required(args.pronouns, MESSAGES.pronouns),
    };
    const member = await ownRow(ctx);
    await ctx.db.patch(member._id, { name, step: Math.max(member.step, stepOf("name")) });
    return null;
  },
});

export const saveContact = mutation({
  args: contactFields,
  returns: v.null(),
  handler: async (ctx, args) => {
    withinLimit(args);
    const member = await ownRow(ctx);
    const personalEmail = normalizeEmail(args.personalEmail);

    const emailError = personalEmailError(personalEmail);
    if (emailError) throw new ConvexError(emailError);
    if (!isPhone(args.phone)) throw new ConvexError(MESSAGES.phone);

    await ctx.db.patch(member._id, {
      contact: { personalEmail, phone: args.phone.trim() },
      step: Math.max(member.step, stepOf("contact")),
    });
    return null;
  },
});

export const saveStudies = mutation({
  args: studiesFields,
  returns: v.null(),
  handler: async (ctx, args) => {
    withinLimit(args);
    const major = required(args.major, MESSAGES.major);
    if (!isGraduationYearAllowed(args.graduationYear)) {
      throw new ConvexError(MESSAGES.year);
    }

    const member = await ownRow(ctx);
    await ctx.db.patch(member._id, {
      studies: { ...args, major, minor: args.minor?.trim() || undefined },
      step: Math.max(member.step, stepOf("studies")),
    });
    return null;
  },
});

export const saveMaterials = mutation({
  args: materialsFields,
  returns: v.null(),
  handler: async (ctx, args) => {
    withinLimit(args);
    const linkedin = profileLink("linkedin", args.linkedin);
    const github = profileLink("github", args.github);

    const member = await ownRow(ctx);
    if (args.resumeBook && !member.resume) {
      throw new ConvexError(MESSAGES.resumeBook);
    }

    await ctx.db.patch(member._id, {
      materials: { linkedin, github, resumeBook: args.resumeBook },
      step: Math.max(member.step, stepOf("materials")),
    });
    return null;
  },
});

export const saveDemographics = mutation({
  args: demographicAnswers,
  returns: v.null(),
  handler: async (ctx, args) => {
    if (args.raceEthnicity.length === 0) throw new ConvexError(MESSAGES.race);
    const raceEthnicity = soleRace(args.raceEthnicity);

    const member = await ownRow(ctx);
    const answers = { ...args, raceEthnicity, memberId: member._id };
    const existing = await findDemographics(ctx, member._id);

    if (existing) await ctx.db.replace(existing._id, answers);
    else await ctx.db.insert("demographics", answers);

    await ctx.db.patch(member._id, { step: Math.max(member.step, stepOf("background")) });
    return null;
  },
});

export const saveInterests = mutation({
  args: interestFields,
  returns: v.null(),
  handler: async (ctx, args) => {
    const member = await ownRow(ctx);
    await ctx.db.patch(member._id, {
      interests: {
        lookingFor: [...new Set(args.lookingFor)],
        hobbies: [...new Set(args.hobbies)],
      },
      step: Math.max(member.step, stepOf("interests")),
    });
    return null;
  },
});

export const removeResume = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const member = await ownRow(ctx);
    if (!member.resume) return null;

    await ctx.storage.delete(member.resume.storageId);
    await ctx.db.patch(member._id, {
      resume: undefined,
      materials: member.materials && { ...member.materials, resumeBook: false },
    });
    return null;
  },
});

export const skip = mutation({
  args: { group: optionalGroup },
  returns: v.null(),
  handler: async (ctx, { group }) => {
    const member = await ownRow(ctx);
    await ctx.db.patch(member._id, { step: Math.max(member.step, stepOf(group)) });
    return null;
  },
});

export const completeTask = mutation({
  args: { task },
  returns: v.null(),
  handler: async (ctx, args) => {
    const member = await ownRow(ctx);
    if (!member.tasksDone.includes(args.task)) {
      await ctx.db.patch(member._id, { tasksDone: [...member.tasksDone, args.task] });
    }
    return null;
  },
});

export const setResume = internalMutation({
  args: { userId: v.string(), storageId: v.id("_storage"), name: v.string(), size: v.number() },
  returns: v.boolean(),
  handler: async (ctx, { userId, ...resume }) => {
    const member = await findMember(ctx, userId);
    if (!member) return false;

    if (member.resume) await ctx.storage.delete(member.resume.storageId);
    await ctx.db.patch(member._id, { resume });
    return true;
  },
});
