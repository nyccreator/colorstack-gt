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

export const gpaRange = v.union(
  v.literal("below_2_5"),
  v.literal("2_5_to_2_8"),
  v.literal("2_9_to_3_2"),
  v.literal("3_3_to_3_6"),
  v.literal("3_7_to_4_0"),
  v.literal("not_applicable"),
);

export const affiliation = v.union(
  v.literal("code_2040"),
  v.literal("nsbe"),
  v.literal("shpe"),
  v.literal("mlt"),
  v.literal("codepath"),
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
  v.literal("other"),
  v.literal("prefer_not_to_say"),
);

export const yesNoPreferNotToSay = v.union(
  v.literal("yes"),
  v.literal("no"),
  v.literal("prefer_not_to_say"),
);

/** Everything the registration form collects about the member. */
export const registrationFields = {
  firstName: v.string(),
  lastName: v.string(),
  /** Lowercased and trimmed before it is written or compared. */
  gtEmail: v.string(),
  personalEmail: v.string(),
  pronouns: v.string(),
  phone: v.string(),
  classification,
  graduationSeason: season,
  graduationYear: v.number(),
  gpa: gpaRange,
  major: v.string(),
  minor: v.optional(v.string()),
  affiliations: v.array(affiliation),
  linkedin: v.optional(v.string()),
  github: v.optional(v.string()),
  interests: v.array(v.string()),
  socialEvents: v.array(v.string()),
  nationalMember: v.boolean(),
  engageJoined: v.boolean(),
  instagramFollowed: v.boolean(),
  whatsappJoined: v.boolean(),
};

/** Set by the chapter and the auth flow, never by the registration form. */
export const memberFields = {
  ...registrationFields,
  /** Absent until the first magic link click, which is when Better Auth creates the user. */
  userId: v.optional(v.string()),
  role,
  /** Absent means the sign up was never confirmed. */
  verifiedAt: v.optional(v.number()),
  resumeStorageId: v.optional(v.id("_storage")),
};

export const demographicAnswers = {
  raceEthnicity,
  gender,
  firstGeneration: yesNoPreferNotToSay,
  lowIncome: yesNoPreferNotToSay,
};

export default defineSchema({
  members: defineTable(memberFields)
    .index("by_userId", ["userId"])
    .index("by_gtEmail", ["gtEmail"])
    .index("by_verifiedAt", ["verifiedAt"]),

  resumeUploads: defineTable({
    token: v.string(),
    storageId: v.id("_storage"),
    expiresAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_expiresAt", ["expiresAt"]),

  /** Separate from members so no ordinary member query can return it. */
  demographics: defineTable({
    ...demographicAnswers,
    memberId: v.id("members"),
  }).index("by_member", ["memberId"]),
});
