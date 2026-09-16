import { ConvexError, v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import {
  internalMutation,
  mutation,
  type MutationCtx,
  query,
  type QueryCtx,
} from "./_generated/server";
import { authComponent } from "./auth";
import { TEXT_MAX_LENGTH } from "./lib/config";
import { isGraduationYearAllowed } from "./lib/graduation";
import { isEmail, isPhone, isProfileUrl, normalizeEmail, normalizeUrl } from "./lib/identity";
import {
  contactFields,
  demographicAnswers,
  interestFields,
  materialsFields,
  nameFields,
  studiesFields,
  task,
} from "./schema";

const skippable = v.union(v.literal(4), v.literal(6));

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

async function ownRow(ctx: MutationCtx) {
  const user = await authComponent.safeGetAuthUser(ctx);
  if (!user) throw new ConvexError("Sign in to continue.");

  const existing = await findMember(ctx, user._id);
  if (existing) return { user, member: existing };

  const id = await ctx.db.insert("members", { userId: user._id, step: 0, tasksDone: [] });
  return { user, member: (await ctx.db.get(id))! };
}

function withinLimit(args: Record<string, unknown>) {
  for (const value of Object.values(args)) {
    if (typeof value === "string" && value.length > TEXT_MAX_LENGTH) {
      throw new ConvexError(`Keep each answer under ${TEXT_MAX_LENGTH} characters.`);
    }
  }
}

function required(value: string, message: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new ConvexError(message);
  return trimmed;
}

function profileLink(value: string | undefined, message: string): string | undefined {
  const url = normalizeUrl(value ?? "");
  if (url && !isProfileUrl(url)) throw new ConvexError(message);
  return url;
}

const profile = v.object({
  gtEmail: v.string(),
  step: v.number(),
  name: v.optional(v.object(nameFields)),
  contact: v.optional(v.object(contactFields)),
  studies: v.optional(v.object(studiesFields)),
  materials: v.optional(v.object(materialsFields)),
  interests: v.optional(v.object(interestFields)),
  resume: v.optional(v.object({ name: v.string(), size: v.number() })),
  tasksDone: v.array(task),
  reported: v.boolean(),
  onRoster: v.boolean(),
  complete: v.boolean(),
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

    return {
      gtEmail,
      step: member?.step ?? 0,
      name: member?.name,
      contact: member?.contact,
      studies: member?.studies,
      materials: member?.materials,
      interests: member?.interests,
      resume: member?.resume && { name: member.resume.name, size: member.resume.size },
      tasksDone: member?.tasksDone ?? [],
      reported,
      onRoster,
      complete: Boolean(member?.name && member.contact && member.studies && reported),
    };
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
      firstName: required(args.firstName, "Enter your first name."),
      lastName: required(args.lastName, "Enter your last name."),
      pronouns: required(args.pronouns, "Choose your pronouns."),
    };
    const { member } = await ownRow(ctx);
    await ctx.db.patch(member._id, { name, step: Math.max(member.step, 1) });
    return null;
  },
});

export const saveContact = mutation({
  args: contactFields,
  returns: v.null(),
  handler: async (ctx, args) => {
    withinLimit(args);
    const { user, member } = await ownRow(ctx);
    const personalEmail = normalizeEmail(args.personalEmail);

    if (!isEmail(personalEmail)) throw new ConvexError("Enter a valid email address.");
    if (personalEmail === normalizeEmail(user.email)) {
      throw new ConvexError("Use an address other than your Georgia Tech email.");
    }
    if (!isPhone(args.phone)) throw new ConvexError("Enter a valid phone number.");

    await ctx.db.patch(member._id, {
      contact: { personalEmail, phone: args.phone.trim() },
      step: Math.max(member.step, 2),
    });
    return null;
  },
});

export const saveStudies = mutation({
  args: studiesFields,
  returns: v.null(),
  handler: async (ctx, args) => {
    withinLimit(args);
    const major = required(args.major, "Choose your major.");
    if (!isGraduationYearAllowed(args.graduationYear)) {
      throw new ConvexError("Choose a graduation year within four years of today.");
    }

    const { member } = await ownRow(ctx);
    await ctx.db.patch(member._id, {
      studies: { ...args, major, minor: args.minor?.trim() || undefined },
      step: Math.max(member.step, 3),
    });
    return null;
  },
});

export const saveMaterials = mutation({
  args: materialsFields,
  returns: v.null(),
  handler: async (ctx, args) => {
    withinLimit(args);
    const linkedin = profileLink(args.linkedin, "Enter a valid LinkedIn link.");
    const github = profileLink(args.github, "Enter a valid GitHub link.");

    const { member } = await ownRow(ctx);
    if (args.resumeBook && !member.resume) {
      throw new ConvexError("Upload a resume to join the resume book.");
    }

    await ctx.db.patch(member._id, {
      materials: { linkedin, github, resumeBook: args.resumeBook },
      step: Math.max(member.step, 4),
    });
    return null;
  },
});

export const saveDemographics = mutation({
  args: demographicAnswers,
  returns: v.null(),
  handler: async (ctx, args) => {
    if (args.raceEthnicity.length === 0) {
      throw new ConvexError("Choose at least one answer for race and ethnicity.");
    }
    const raceEthnicity = args.raceEthnicity.includes("prefer_not_to_answer")
      ? ["prefer_not_to_answer" as const]
      : [...new Set(args.raceEthnicity)];

    const { member } = await ownRow(ctx);
    const answers = { ...args, raceEthnicity, memberId: member._id };
    const existing = await findDemographics(ctx, member._id);

    if (existing) await ctx.db.replace(existing._id, answers);
    else await ctx.db.insert("demographics", answers);

    await ctx.db.patch(member._id, { step: Math.max(member.step, 5) });
    return null;
  },
});

export const saveInterests = mutation({
  args: interestFields,
  returns: v.null(),
  handler: async (ctx, args) => {
    const { member } = await ownRow(ctx);
    await ctx.db.patch(member._id, {
      interests: {
        lookingFor: [...new Set(args.lookingFor)],
        hobbies: [...new Set(args.hobbies)],
      },
      step: Math.max(member.step, 6),
    });
    return null;
  },
});

export const skip = mutation({
  args: { step: skippable },
  returns: v.null(),
  handler: async (ctx, { step }) => {
    const { member } = await ownRow(ctx);
    await ctx.db.patch(member._id, { step: Math.max(member.step, step) });
    return null;
  },
});

export const completeTask = mutation({
  args: { task },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { member } = await ownRow(ctx);
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
