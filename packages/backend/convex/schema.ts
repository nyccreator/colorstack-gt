import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const role = v.union(v.literal("member"), v.literal("board"), v.literal("admin"));

export const classification = v.union(
  v.literal("first_year"),
  v.literal("second_year"),
  v.literal("third_year"),
  v.literal("fourth_year"),
  v.literal("fifth_year_plus"),
  v.literal("graduate"),
);

export const season = v.union(
  v.literal("spring"),
  v.literal("summer"),
  v.literal("fall"),
  v.literal("winter"),
);

export const raceEthnicity = v.union(
  v.literal("black"),
  v.literal("hispanic"),
  v.literal("native_american"),
  v.literal("asian"),
  v.literal("middle_eastern"),
  v.literal("white"),
  v.literal("other"),
  v.literal("prefer_not_to_say"),
);

export const gender = v.union(
  v.literal("cis_man"),
  v.literal("cis_woman"),
  v.literal("trans_man"),
  v.literal("trans_woman"),
  v.literal("nonbinary"),
  v.literal("prefer_not_to_say"),
);

export const yesNoPreferNotToSay = v.union(
  v.literal("yes"),
  v.literal("no"),
  v.literal("prefer_not_to_say"),
);

export default defineSchema({
  members: defineTable({
    /** Absent until the first magic link click, which is when Better Auth creates the user. */
    userId: v.optional(v.string()),
    firstName: v.string(),
    lastName: v.string(),
    /** Lowercased and trimmed before it is written or compared. */
    gtEmail: v.string(),
    personalEmail: v.optional(v.string()),
    pronouns: v.optional(v.string()),
    phone: v.optional(v.string()),
    classification,
    graduationSeason: season,
    graduationYear: v.number(),
    major: v.string(),
    minor: v.optional(v.string()),
    linkedin: v.optional(v.string()),
    github: v.optional(v.string()),
    resumeStorageId: v.optional(v.id("_storage")),
    interests: v.array(v.string()),
    nationalMember: v.boolean(),
    engageJoined: v.boolean(),
    heardAbout: v.optional(v.string()),
    role,
    /** Absent means the sign up was never confirmed. */
    verifiedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_gtEmail", ["gtEmail"])
    .index("by_verifiedAt", ["verifiedAt"]),

  /** Separate from members so no ordinary member query can return it. */
  demographics: defineTable({
    memberId: v.id("members"),
    raceEthnicity: v.optional(v.array(raceEthnicity)),
    raceEthnicityOther: v.optional(v.string()),
    gender: v.optional(gender),
    firstGeneration: v.optional(yesNoPreferNotToSay),
    lowIncome: v.optional(yesNoPreferNotToSay),
  }).index("by_member", ["memberId"]),
});
