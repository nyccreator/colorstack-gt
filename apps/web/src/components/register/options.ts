export const CLASSIFICATIONS = [
  { value: "first_year", label: "First-year" },
  { value: "second_year", label: "Second-year" },
  { value: "third_year", label: "Third-year" },
  { value: "fourth_year", label: "Fourth-year" },
  { value: "fifth_year_plus", label: "Fifth-year+" },
  { value: "graduate", label: "Master's / PhD" },
] as const;

export const SEASONS = [
  { value: "spring", label: "Spring" },
  { value: "summer", label: "Summer" },
  { value: "fall", label: "Fall" },
  { value: "winter", label: "Winter" },
] as const;

export const AFFILIATIONS = [
  { value: "code_2040", label: "Code 2040" },
  { value: "nsbe", label: "National Society of Black Engineers (NSBE)" },
  { value: "shpe", label: "Society of Hispanic Professional Engineers (SHPE)" },
  { value: "mlt", label: "Management Leadership for Tomorrow (MLT)" },
  { value: "codepath", label: "CodePath" },
] as const;

export const GPA_RANGES = [
  { value: "below_2_5", label: "0.0 - 2.4" },
  { value: "2_5_to_2_8", label: "2.5 - 2.8" },
  { value: "2_9_to_3_2", label: "2.9 - 3.2" },
  { value: "3_3_to_3_6", label: "3.3 - 3.6" },
  { value: "3_7_to_4_0", label: "3.7 - 4.0" },
  { value: "not_applicable", label: "N/A" },
] as const;

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
] as const;

export const GENDERS = [
  { value: "cis_man", label: "Cisgender Man" },
  { value: "cis_woman", label: "Cisgender Woman" },
  { value: "trans_man", label: "Transgender Man" },
  { value: "trans_woman", label: "Transgender Woman" },
  { value: "nonbinary", label: "Gender Non-Conforming / Non-Binary" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
] as const;

export const YES_NO = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
] as const;

export const YES_NO_PRIVATE = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
] as const;

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

export const STEPS = [
  "About you",
  "Your studies",
  "Experience",
  "What you want from ColorStack",
  "Background",
  "Before you join",
] as const;
