import type { api } from "@colorstack-gt/backend/convex/_generated/api";
import type { FunctionArgs } from "convex/server";

export type Studies = FunctionArgs<typeof api.members.saveStudies>;
export type Answers = FunctionArgs<typeof api.members.saveDemographics>;
export type Interests = FunctionArgs<typeof api.members.saveInterests>;
export type Task = FunctionArgs<typeof api.members.completeTask>["task"];

type Options<T extends string> = readonly { value: T; label: string }[];

export const SELF_DESCRIBE = "Self-describe";

export const PRONOUNS = ["she / her", "he / him", "they / them", SELF_DESCRIBE] as const;

export const CLASS_STANDINGS = [
  { value: "first_year", label: "First-year" },
  { value: "second_year", label: "Second-year" },
  { value: "third_year", label: "Third-year" },
  { value: "fourth_year", label: "Fourth-year" },
  { value: "fifth_year_plus", label: "Fifth-year+" },
  { value: "masters", label: "Master's" },
  { value: "phd", label: "PhD" },
] as const satisfies Options<Studies["classStanding"]>;

export const SEASONS = [
  { value: "spring", label: "Spring" },
  { value: "summer", label: "Summer" },
  { value: "fall", label: "Fall" },
  { value: "winter", label: "Winter" },
] as const satisfies Options<Studies["graduationSeason"]>;

export const GPA_RANGES = [
  { value: "below_2_5", label: "0.0 – 2.4" },
  { value: "2_5_to_2_8", label: "2.5 – 2.8" },
  { value: "2_9_to_3_2", label: "2.9 – 3.2" },
  { value: "3_3_to_3_6", label: "3.3 – 3.6" },
  { value: "3_7_to_4_0", label: "3.7 – 4.0" },
  { value: "not_applicable", label: "N/A" },
] as const satisfies Options<Studies["gpa"]>;

export const RACES = [
  { value: "american_indian_or_alaska_native", label: "American Indian or Alaska Native" },
  { value: "asian", label: "Asian" },
  { value: "black_or_african_american", label: "Black or African American" },
  { value: "hispanic_or_latino", label: "Hispanic or Latino" },
  { value: "middle_eastern_or_north_african", label: "Middle Eastern or North African" },
  { value: "native_hawaiian_or_pacific_islander", label: "Native Hawaiian or Pacific Islander" },
  { value: "white", label: "White" },
  { value: "prefer_not_to_answer", label: "Prefer not to answer" },
] as const satisfies Options<Answers["raceEthnicity"][number]>;

export const GENDERS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "non_binary", label: "Non-binary" },
  { value: "prefer_not_to_answer", label: "Prefer not to answer" },
] as const satisfies Options<Answers["gender"]>;

export const YES_NO = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "prefer_not_to_answer", label: "Prefer not to answer" },
] as const satisfies Options<Answers["firstGeneration"]>;

export const LOOKING_FOR = [
  { value: "recruiting", label: "Recruiting opportunities" },
  { value: "interview_prep", label: "Interview preparation" },
  { value: "academic_help", label: "Homework and academic help" },
  { value: "career_exploration", label: "Career exploration" },
  { value: "social_activities", label: "Social activities" },
  { value: "building_projects", label: "Building projects" },
  { value: "mentorship", label: "Mentorship programs" },
  { value: "hackathons", label: "Hackathons" },
] as const satisfies Options<Interests["lookingFor"][number]>;

export const HOBBIES = [
  { value: "baking", label: "Baking" },
  { value: "board_games", label: "Board Games" },
  { value: "video_games", label: "Video Games" },
  { value: "sports", label: "Sports" },
  { value: "yoga", label: "Yoga" },
  { value: "hiking", label: "Hiking" },
  { value: "running", label: "Running" },
  { value: "dancing", label: "Dancing" },
  { value: "singing", label: "Singing" },
  { value: "drawing", label: "Drawing" },
  { value: "reading", label: "Reading" },
  { value: "volunteering", label: "Volunteering" },
] as const satisfies Options<Interests["hobbies"][number]>;

export const STAGES = [
  { title: "Who you are", detail: "Name and pronouns" },
  { title: "How we reach you", detail: "Personal email and phone" },
  { title: "You at Tech", detail: "Standing, major, graduation, GPA range" },
  { title: "Your materials", detail: "LinkedIn, GitHub, resume" },
  {
    title: "The part we report",
    detail: "Four questions, each with a prefer-not-to-answer option",
  },
  { title: "What you're here for", detail: "What you're looking for, hobbies" },
] as const;

export const TASKS = [
  {
    value: "engage",
    title: "Join us on Engage",
    detail: "Georgia Tech's student organization platform, where our official roster lives.",
    href: "https://gatech.campuslabs.com/engage/organization/colorstack-at-gt",
  },
  {
    value: "national",
    title: "Become a ColorStack National member",
    detail:
      "A separate membership that opens the national job board, the Slack community, and Fam Fridays.",
    href: "https://app.colorstack.io/apply",
  },
  {
    value: "whatsapp",
    title: "Join the WhatsApp community",
    detail: "Where we post announcements and keep in touch between events.",
    href: "https://chat.whatsapp.com/GeflwhJgwTq7GOzvHVPv7p",
  },
  {
    value: "instagram",
    title: "Follow @colorstackgt",
    detail: "Upcoming events, recaps, and recruiting deadlines.",
    href: "https://www.instagram.com/colorstackgt/",
  },
] as const satisfies readonly { value: Task; title: string; detail: string; href: string }[];

export const THINGS = ["No things", "One thing", "Two things", "Three things", "Four things"];
