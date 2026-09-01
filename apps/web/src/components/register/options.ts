import type { ProgressKey, Submission } from "./state";

type Options<T extends string> = readonly { value: T; label: string }[];

type Section = {
  id: string;
  chapter: number;
  label: string;
  /** Must be answered before the chapter lets you past it. Drives the rail's counts. */
  required: readonly ProgressKey[];
  /** Counted only so an error on one can be traced back to its section. */
  optional: readonly ProgressKey[];
};

export const CLASSIFICATIONS = [
  { value: "first_year", label: "First-year" },
  { value: "second_year", label: "Second-year" },
  { value: "third_year", label: "Third-year" },
  { value: "fourth_year", label: "Fourth-year" },
  { value: "fifth_year_plus", label: "Fifth-year+" },
  { value: "graduate", label: "Master's / PhD" },
] as const satisfies Options<Submission["classification"]>;

export const SEASONS = [
  { value: "spring", label: "Spring" },
  { value: "summer", label: "Summer" },
  { value: "fall", label: "Fall" },
  { value: "winter", label: "Winter" },
] as const satisfies Options<Submission["graduationSeason"]>;

export const AFFILIATIONS = [
  { value: "code_2040", label: "Code 2040" },
  { value: "nsbe", label: "National Society of Black Engineers (NSBE)" },
  { value: "shpe", label: "Society of Hispanic Professional Engineers (SHPE)" },
  { value: "mlt", label: "Management Leadership for Tomorrow (MLT)" },
  { value: "codepath", label: "CodePath" },
] as const satisfies Options<Submission["affiliations"][number]>;

export const GPA_RANGES = [
  { value: "below_2_5", label: "0.0 - 2.4" },
  { value: "2_5_to_2_8", label: "2.5 - 2.8" },
  { value: "2_9_to_3_2", label: "2.9 - 3.2" },
  { value: "3_3_to_3_6", label: "3.3 - 3.6" },
  { value: "3_7_to_4_0", label: "3.7 - 4.0" },
  { value: "not_applicable", label: "N/A" },
] as const satisfies Options<Submission["gpa"]>;

export const INTERESTS = [
  "Recruiting opportunities",
  "Interview preparation",
  "Homework and academic help",
  "Career exploration",
  "Social activities",
  "Building projects",
  "Mentorship programs",
  "Hackathons",
] as const;

export const SOCIAL_EVENTS = [
  "Baking",
  "Board Games",
  "Video Games",
  "Sports",
  "Yoga",
  "Hiking",
  "Running",
  "Dancing",
  "Singing",
  "Drawing",
  "Reading",
  "Volunteering",
] as const;

export const RACE_ETHNICITIES = [
  { value: "black", label: "Black / African-American / Afro-Latinx" },
  { value: "hispanic", label: "Hispanic / Latinx (Non-White)" },
  { value: "native_american", label: "Native American / Alaska Native" },
  { value: "asian", label: "Asian / Asian-American" },
  { value: "middle_eastern", label: "Middle Eastern" },
  { value: "white", label: "White (Non-Hispanic/Latinx)" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
] as const satisfies Options<Submission["demographics"]["raceEthnicity"]>;

export const GENDERS = [
  { value: "cis_man", label: "Cisgender Man" },
  { value: "cis_woman", label: "Cisgender Woman" },
  { value: "trans_man", label: "Transgender Man" },
  { value: "trans_woman", label: "Transgender Woman" },
  { value: "nonbinary", label: "Gender Non-Conforming / Non-Binary" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
] as const satisfies Options<Submission["demographics"]["gender"]>;

export const YES_NO_PRIVATE = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
] as const satisfies Options<Submission["demographics"]["firstGeneration"]>;

export const COMMUNITIES = [
  {
    key: "nationalMember",
    label: "Are you a national ColorStack member?",
    linkLabel: "Apply to ColorStack",
    href: "https://app.colorstack.io/apply",
  },
  {
    key: "engageJoined",
    label: "Have you joined ColorStack on Engage?",
    linkLabel: "Join on Engage",
    href: "https://gatech.campuslabs.com/engage/",
  },
  {
    key: "instagramFollowed",
    label: "Do you follow @colorstackgt on Instagram?",
    linkLabel: "Follow on Instagram",
    href: "https://www.instagram.com/colorstackgt/",
  },
  {
    key: "whatsappJoined",
    label: "Have you joined our WhatsApp community?",
    linkLabel: "Join on WhatsApp",
    href: "https://chat.whatsapp.com/GeflwhJgwTq7GOzvHVPv7p",
  },
] as const;

export const CHAPTERS = [
  { num: "01", title: "You" },
  { num: "02", title: "Your interests" },
  { num: "03", title: "Joining" },
] as const;

/**
 * The anchors the rail scrolls to, and the fields each one counts toward
 * progress.
 */
export const SECTIONS = [
  {
    id: "sec-contact",
    chapter: 1,
    label: "Contact",
    required: ["firstName", "lastName", "pronouns", "gtEmail", "personalEmail", "phone"],
    optional: [],
  },
  {
    id: "sec-studies",
    chapter: 1,
    label: "Studies",
    required: ["classification", "graduation", "gpa", "major"],
    optional: ["minor"],
  },
  {
    id: "sec-links",
    chapter: 1,
    label: "Links",
    required: [],
    optional: ["linkedin", "github", "resume"],
  },
  {
    id: "sec-background",
    chapter: 1,
    label: "Background",
    required: ["raceEthnicity", "gender", "firstGeneration", "lowIncome"],
    optional: [],
  },
  {
    id: "sec-affiliations",
    chapter: 2,
    label: "Affiliations",
    required: [],
    optional: ["affiliations"],
  },
  {
    id: "sec-want",
    chapter: 2,
    label: "What you want",
    required: [],
    optional: ["interests", "socialEvents"],
  },
  {
    id: "sec-connections",
    chapter: 3,
    label: "Connections",
    required: ["nationalMember", "engageJoined", "instagramFollowed", "whatsappJoined"],
    optional: [],
  },
  { id: "sec-review", chapter: 3, label: "Review", required: [], optional: [] },
] as const satisfies readonly Section[];
