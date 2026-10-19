import type { api } from "@colorstack-gt/backend/convex/_generated/api";
import { graduationYearOptions } from "@colorstack-gt/backend/convex/lib/graduation";
import type { FunctionArgs } from "convex/server";

export type Studies = FunctionArgs<typeof api.members.saveStudies>;
export type Answers = FunctionArgs<typeof api.members.saveDemographics>;
export type Interests = FunctionArgs<typeof api.members.saveInterests>;
export type Task = FunctionArgs<typeof api.members.completeTask>["task"];

export type Option<T extends string> = { readonly value: T; readonly label: string };

// Key order is display order.
function listOf<T extends string>(labels: Record<T, string>): readonly Option<T>[] {
  return (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));
}

export const labelOf = <T extends string>(options: readonly Option<T>[], value: T | undefined) =>
  options.find((option) => option.value === value)?.label ?? "";

export const labelsOf = <T extends string>(
  options: readonly Option<T>[],
  values: readonly T[] = [],
) => options.filter((option) => values.includes(option.value)).map((option) => option.label);

export const SELF_DESCRIBE = "Self-describe";

export const PRONOUNS = ["she / her", "he / him", "they / them", SELF_DESCRIBE] as const;

export const PRONOUN_OPTIONS = PRONOUNS.map((value) => ({ value, label: value }));

export const CLASS_STANDINGS = listOf<Studies["classStanding"]>({
  first_year: "First-year",
  second_year: "Second-year",
  third_year: "Third-year",
  fourth_year: "Fourth-year",
  fifth_year_plus: "Fifth-year+",
  masters: "Master’s",
  phd: "PhD",
});

export const SEASONS = listOf<Studies["graduationSeason"]>({
  fall: "Fall",
  spring: "Spring",
  summer: "Summer",
});

export const YEAR_OPTIONS = graduationYearOptions().map((year) => ({
  value: String(year),
  label: String(year),
}));

export const GPA_RANGES = listOf<Studies["gpa"]>({
  below_2_5: "0.0 – 2.4",
  "2_5_to_2_8": "2.5 – 2.8",
  "2_9_to_3_2": "2.9 – 3.2",
  "3_3_to_3_6": "3.3 – 3.6",
  "3_7_to_4_0": "3.7 – 4.0",
  not_applicable: "Not applicable",
});

export const RACES = listOf<Answers["raceEthnicity"][number]>({
  american_indian_or_alaska_native: "American Indian or Alaska Native",
  asian: "Asian",
  black_or_african_american: "Black or African American",
  hispanic_or_latino: "Hispanic or Latino",
  middle_eastern_or_north_african: "Middle Eastern or North African",
  native_hawaiian_or_pacific_islander: "Native Hawaiian or Pacific Islander",
  white: "White",
  prefer_not_to_answer: "Prefer not to answer",
});

export const GENDERS = listOf<Answers["gender"]>({
  male: "Male",
  female: "Female",
  non_binary: "Non-binary",
  prefer_not_to_answer: "Prefer not to answer",
});

export const YES_NO = listOf<Answers["firstGeneration"]>({
  yes: "Yes",
  no: "No",
  prefer_not_to_answer: "Prefer not to answer",
});

export const LOOKING_FOR = listOf<Interests["lookingFor"][number]>({
  recruiting: "Recruiting opportunities",
  interview_prep: "Interview preparation",
  academic_help: "Homework and academic help",
  career_exploration: "Career exploration",
  social_activities: "Social activities",
  building_projects: "Building projects",
  mentorship: "Mentorship programs",
  hackathons: "Hackathons",
});

export const HOBBIES = listOf<Interests["hobbies"][number]>({
  baking: "Baking",
  board_games: "Board games",
  video_games: "Video games",
  sports: "Sports",
  yoga: "Yoga",
  hiking: "Hiking",
  running: "Running",
  dancing: "Dancing",
  singing: "Singing",
  drawing: "Drawing",
  reading: "Reading",
  volunteering: "Volunteering",
});

export const TASKS = {
  engage: {
    title: "Join us on Engage",
    detail: "Georgia Tech's student organization platform, where our official roster lives.",
    href: "https://gatech.campuslabs.com/engage/organization/colorstack-at-gt",
  },
  national: {
    title: "Become a ColorStack National member",
    detail:
      "A separate membership that opens the national job board, the Slack community, and Fam Fridays.",
    href: "https://app.colorstack.io/apply",
  },
  whatsapp: {
    title: "Join the WhatsApp community",
    detail: "Where we post announcements and keep in touch between events.",
    href: "https://chat.whatsapp.com/GeflwhJgwTq7GOzvHVPv7p",
  },
  instagram: {
    title: "Follow @colorstackgt on Instagram",
    detail: "Upcoming events, recaps, and recruiting deadlines.",
    href: "https://www.instagram.com/colorstackgt/",
  },
} satisfies Record<Task, { title: string; detail: string; href: string }>;
