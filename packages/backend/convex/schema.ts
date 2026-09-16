import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const classStanding = v.union(
  v.literal("first_year"),
  v.literal("second_year"),
  v.literal("third_year"),
  v.literal("fourth_year"),
  v.literal("fifth_year_plus"),
  v.literal("masters"),
  v.literal("phd"),
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

export const race = v.union(
  v.literal("american_indian_or_alaska_native"),
  v.literal("asian"),
  v.literal("black_or_african_american"),
  v.literal("hispanic_or_latino"),
  v.literal("middle_eastern_or_north_african"),
  v.literal("native_hawaiian_or_pacific_islander"),
  v.literal("white"),
  v.literal("prefer_not_to_answer"),
);

export const gender = v.union(
  v.literal("male"),
  v.literal("female"),
  v.literal("non_binary"),
  v.literal("prefer_not_to_answer"),
);

export const yesNo = v.union(v.literal("yes"), v.literal("no"), v.literal("prefer_not_to_answer"));

export const lookingFor = v.union(
  v.literal("recruiting"),
  v.literal("interview_prep"),
  v.literal("academic_help"),
  v.literal("career_exploration"),
  v.literal("social_activities"),
  v.literal("building_projects"),
  v.literal("mentorship"),
  v.literal("hackathons"),
);

export const hobby = v.union(
  v.literal("baking"),
  v.literal("board_games"),
  v.literal("video_games"),
  v.literal("sports"),
  v.literal("yoga"),
  v.literal("hiking"),
  v.literal("running"),
  v.literal("dancing"),
  v.literal("singing"),
  v.literal("drawing"),
  v.literal("reading"),
  v.literal("volunteering"),
);

export const task = v.union(
  v.literal("engage"),
  v.literal("national"),
  v.literal("whatsapp"),
  v.literal("instagram"),
);

export const nameFields = {
  firstName: v.string(),
  lastName: v.string(),
  pronouns: v.string(),
};

export const contactFields = {
  personalEmail: v.string(),
  phone: v.string(),
};

export const studiesFields = {
  classStanding,
  major: v.string(),
  minor: v.optional(v.string()),
  graduationSeason: season,
  graduationYear: v.number(),
  gpa: gpaRange,
};

export const materialsFields = {
  linkedin: v.optional(v.string()),
  github: v.optional(v.string()),
  resumeBook: v.boolean(),
};

export const demographicAnswers = {
  raceEthnicity: v.array(race),
  gender,
  firstGeneration: yesNo,
  lowIncome: yesNo,
};

export const interestFields = {
  lookingFor: v.array(lookingFor),
  hobbies: v.array(hobby),
};

export default defineSchema({
  members: defineTable({
    userId: v.string(),
    step: v.number(),
    name: v.optional(v.object(nameFields)),
    contact: v.optional(v.object(contactFields)),
    studies: v.optional(v.object(studiesFields)),
    materials: v.optional(v.object(materialsFields)),
    interests: v.optional(v.object(interestFields)),
    resume: v.optional(
      v.object({ storageId: v.id("_storage"), name: v.string(), size: v.number() }),
    ),
    tasksDone: v.array(task),
  }).index("by_userId", ["userId"]),

  /** Separate from members so no ordinary member query can return it. */
  demographics: defineTable({
    ...demographicAnswers,
    memberId: v.id("members"),
  }).index("by_member", ["memberId"]),

  roster: defineTable({ email: v.string() }).index("by_email", ["email"]),

  audits: defineTable({ exportedAt: v.number(), emails: v.number() }).index("by_exportedAt", [
    "exportedAt",
  ]),
});
