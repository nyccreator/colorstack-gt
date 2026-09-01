import type { api } from "@colorstack-gt/backend/convex/_generated/api";
import { RESUME_MAX_BYTES } from "@colorstack-gt/backend/convex/lib/config";
import {
  isGeorgiaTechEmail,
  isPhone,
  normalizeEmail,
} from "@colorstack-gt/backend/convex/lib/identity";
import type { FunctionArgs } from "convex/server";

import { SECTIONS } from "./options";

export type Submission = FunctionArgs<typeof api.members.register>;

export type FormState = {
  firstName: string;
  lastName: string;
  gtEmail: string;
  personalEmail: string;
  pronouns: string;
  phone: string;
  classification: string;
  graduationSeason: string;
  graduationYear: string;
  gpa: string;
  major: string;
  minor: string;
  affiliations: string[];
  linkedin: string;
  github: string;
  resume: File | null;
  interests: string[];
  socialEvents: string[];
  nationalMember: string;
  engageJoined: string;
  instagramFollowed: string;
  whatsappJoined: string;
  raceEthnicity: string;
  gender: string;
  firstGeneration: string;
  lowIncome: string;
};

export type Errors = Partial<Record<keyof FormState, string>>;

/** A field the rail counts, plus the pairing that stands in for the two graduation selects. */
export type ProgressKey = keyof FormState | "graduation";

export type SectionProgress = {
  id: string;
  chapter: number;
  label: string;
  /** Required answers given, out of the required answers asked for. */
  done: number;
  total: number;
  /** How many optional fields the section holds, which nothing is counted against. */
  optional: number;
  complete: boolean;
  /** Whether any field in the section is currently showing an error. */
  error: boolean;
};

/** Nothing required and nothing given still counts as done. Empty sections never do. */
export function isComplete(done: number, total: number, optional: number): boolean {
  return total > 0 ? done === total : optional > 0;
}

export function emptyForm(email?: string): FormState {
  return {
    firstName: "",
    lastName: "",
    gtEmail: email ?? "",
    personalEmail: "",
    pronouns: "",
    phone: "",
    classification: "",
    graduationSeason: "",
    graduationYear: "",
    gpa: "",
    major: "",
    minor: "",
    affiliations: [],
    linkedin: "",
    github: "",
    resume: null,
    interests: [],
    socialEvents: [],
    nationalMember: "",
    engageJoined: "",
    instagramFollowed: "",
    whatsappJoined: "",
    raceEthnicity: "",
    gender: "",
    firstGeneration: "",
    lowIncome: "",
  };
}

/** Accepts a bare host like linkedin.com/in/you as well as a full URL. */
function isProfileUrl(value: string): boolean {
  const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    return new URL(candidate).hostname.includes(".");
  } catch {
    return false;
  }
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function normalizeUrl(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

const optional = (value: string) => (value.trim() ? value.trim() : undefined);

export function toggleValue(current: string[], value: string): string[] {
  return current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
}

/** Shapes the form for the register action. Step validation has already required each choice. */
export function toSubmission(form: FormState, resumeUploadToken?: string): Submission {
  return {
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    gtEmail: form.gtEmail.trim().toLowerCase(),
    personalEmail: form.personalEmail.trim(),
    pronouns: form.pronouns.trim(),
    phone: form.phone.trim(),
    classification: form.classification as Submission["classification"],
    graduationSeason: form.graduationSeason as Submission["graduationSeason"],
    graduationYear: Number(form.graduationYear),
    gpa: form.gpa as Submission["gpa"],
    major: form.major.trim(),
    minor: optional(form.minor),
    affiliations: form.affiliations as Submission["affiliations"],
    linkedin: normalizeUrl(form.linkedin),
    github: normalizeUrl(form.github),
    resumeUploadToken,
    interests: form.interests,
    socialEvents: form.socialEvents,
    nationalMember: form.nationalMember === "yes",
    engageJoined: form.engageJoined === "yes",
    instagramFollowed: form.instagramFollowed === "yes",
    whatsappJoined: form.whatsappJoined === "yes",
    demographics: {
      raceEthnicity: form.raceEthnicity,
      gender: form.gender,
      firstGeneration: form.firstGeneration,
      lowIncome: form.lowIncome,
    } as Submission["demographics"],
  };
}

function isFilled(form: FormState, key: ProgressKey): boolean {
  if (key === "graduation") return Boolean(form.graduationSeason && form.graduationYear);

  const value: FormState[keyof FormState] = form[key];
  if (value === null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

export function sectionProgress(form: FormState, errors: Errors): SectionProgress[] {
  return SECTIONS.map((section) => {
    const done = section.required.filter((key) => isFilled(form, key)).length;
    const total = section.required.length;
    const optional = section.optional.length;
    return {
      id: section.id,
      chapter: section.chapter,
      label: section.label,
      done,
      total,
      optional,
      complete: isComplete(done, total, optional),
      error: [...section.required, ...section.optional].some((key) => hasError(errors, key)),
    };
  });
}

function hasError(errors: Errors, key: ProgressKey): boolean {
  if (key === "graduation") return Boolean(errors.graduationSeason ?? errors.graduationYear);
  return Boolean(errors[key]);
}

/** The section to send someone to when Continue turns up errors. */
export function firstErrorSection(errors: Errors): string | undefined {
  return SECTIONS.find((section) =>
    [...section.required, ...section.optional].some((key) => hasError(errors, key)),
  )?.id;
}

export function validateChapter(chapter: number, form: FormState): Errors {
  const errors: Errors = {};

  if (chapter === 1) {
    if (!form.firstName.trim()) errors.firstName = "Enter your first name.";
    if (!form.lastName.trim()) errors.lastName = "Enter your last name.";
    if (!form.pronouns.trim()) errors.pronouns = "Enter your pronouns.";
    if (!form.gtEmail.trim()) {
      errors.gtEmail = "Enter your Georgia Tech email.";
    } else if (!isGeorgiaTechEmail(form.gtEmail)) {
      errors.gtEmail = "Enter a gatech.edu address.";
    }
    if (!form.personalEmail.trim()) {
      errors.personalEmail = "Enter a personal email.";
    } else if (!isEmail(form.personalEmail)) {
      errors.personalEmail = "Enter a valid email address.";
    } else if (normalizeEmail(form.personalEmail) === normalizeEmail(form.gtEmail)) {
      errors.personalEmail = "Use an address other than your Georgia Tech email.";
    }
    if (!form.phone.trim()) {
      errors.phone = "Enter your phone number.";
    } else if (!isPhone(form.phone)) {
      errors.phone = "Enter a valid phone number.";
    }

    if (!form.classification) errors.classification = "Choose your classification.";
    if (!form.graduationSeason) errors.graduationSeason = "Choose a season.";
    if (!form.graduationYear) errors.graduationYear = "Choose a year.";
    if (!form.gpa) errors.gpa = "Choose a range.";
    if (!form.major.trim()) errors.major = "Enter your major.";

    if (form.linkedin.trim() && !isProfileUrl(form.linkedin)) {
      errors.linkedin = "Enter a valid LinkedIn link.";
    }
    if (form.github.trim() && !isProfileUrl(form.github)) {
      errors.github = "Enter a valid GitHub link.";
    }
    if (form.resume) {
      if (form.resume.type !== "application/pdf") errors.resume = "Upload a PDF.";
      else if (form.resume.size > RESUME_MAX_BYTES) errors.resume = "Keep the file under 5MB.";
    }

    if (!form.raceEthnicity) errors.raceEthnicity = "Choose an answer.";
    if (!form.gender) errors.gender = "Choose an answer.";
    if (!form.firstGeneration) errors.firstGeneration = "Choose an answer.";
    if (!form.lowIncome) errors.lowIncome = "Choose an answer.";
  }

  if (chapter === 3) {
    if (!form.nationalMember) errors.nationalMember = "Choose an answer.";
    if (!form.engageJoined) errors.engageJoined = "Choose an answer.";
    if (!form.instagramFollowed) errors.instagramFollowed = "Choose an answer.";
    if (!form.whatsappJoined) errors.whatsappJoined = "Choose an answer.";
  }

  return errors;
}
