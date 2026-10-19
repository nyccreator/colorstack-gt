import { api } from "@colorstack-gt/backend/convex/_generated/api";
import { RESUME_CONTENT_TYPE, RESUME_MAX_BYTES } from "@colorstack-gt/backend/convex/lib/config";
import { toggleRace } from "@colorstack-gt/backend/convex/lib/demographics";
import { isGraduationYearAllowed } from "@colorstack-gt/backend/convex/lib/graduation";
import type { Group } from "@colorstack-gt/backend/convex/lib/groups";
import {
  isPhone,
  personalEmailError,
  profileError,
  profileName,
  type ProfileSite,
} from "@colorstack-gt/backend/convex/lib/identity";
import { MESSAGES } from "@colorstack-gt/backend/convex/lib/messages";
import { env } from "@colorstack-gt/env/web";
import { useMutation } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { ConvexError } from "convex/values";

import { authClient } from "@/lib/auth-client";
import type { Answers, Profile } from "@/lib/member";

import {
  CLASS_STANDINGS,
  GENDERS,
  GPA_RANGES,
  HOBBIES,
  type Interests,
  LOOKING_FOR,
  type Option,
  PRONOUN_OPTIONS,
  PRONOUNS,
  RACES,
  SEASONS,
  SELF_DESCRIBE,
  type Studies,
  YEAR_OPTIONS,
  YES_NO,
} from "../onboarding/options";

export type Draft = {
  firstName: string;
  lastName: string;
  choice: string;
  writeIn: string;
  personalEmail: string;
  phone: string;
  standing: Studies["classStanding"] | "";
  major: string;
  minor: string;
  season: Studies["graduationSeason"] | "";
  year: string;
  gpa: Studies["gpa"] | "";
  linkedin: string;
  github: string;
  resumeBook: boolean;
  races: Answers["raceEthnicity"];
  gender: Answers["gender"] | "";
  firstGeneration: Answers["firstGeneration"] | "";
  lowIncome: Answers["lowIncome"] | "";
  lookingFor: Interests["lookingFor"];
  hobbies: Interests["hobbies"];
};

export type Field = keyof Draft;

const GROUP_OF_FIELD = {
  firstName: "name",
  lastName: "name",
  choice: "name",
  writeIn: "name",
  personalEmail: "contact",
  phone: "contact",
  standing: "studies",
  major: "studies",
  minor: "studies",
  season: "studies",
  year: "studies",
  gpa: "studies",
  linkedin: "materials",
  github: "materials",
  resumeBook: "materials",
  races: "background",
  gender: "background",
  firstGeneration: "background",
  lowIncome: "background",
  lookingFor: "interests",
  hobbies: "interests",
} as const satisfies Record<Field, Group>;

const isField = (key: string | undefined): key is Field =>
  key !== undefined && key in GROUP_OF_FIELD;

const fieldsOf = (group: Group) =>
  (Object.keys(GROUP_OF_FIELD) as Field[]).filter((field) => GROUP_OF_FIELD[field] === group);

export const FIELDS: Record<Group, readonly Field[]> = {
  name: fieldsOf("name"),
  contact: fieldsOf("contact"),
  studies: fieldsOf("studies"),
  materials: fieldsOf("materials"),
  interests: fieldsOf("interests"),
  background: fieldsOf("background"),
};

export function draftFrom(me: Profile, answers: Answers | null): Draft {
  const pronouns = me.name?.pronouns ?? "";
  const listed = PRONOUNS.some((option) => option === pronouns && option !== SELF_DESCRIBE);
  return {
    firstName: me.name?.firstName ?? "",
    lastName: me.name?.lastName ?? "",
    choice: pronouns ? (listed ? pronouns : SELF_DESCRIBE) : "",
    writeIn: listed ? "" : pronouns,
    personalEmail: me.contact?.personalEmail ?? "",
    phone: me.contact?.phone ?? "",
    standing: me.studies?.classStanding ?? "",
    major: me.studies?.major ?? "",
    minor: me.studies?.minor ?? "",
    season: me.studies?.graduationSeason ?? "",
    year: me.studies ? String(me.studies.graduationYear) : "",
    gpa: me.studies?.gpa ?? "",
    linkedin: profileName("linkedin", me.materials?.linkedin ?? ""),
    github: profileName("github", me.materials?.github ?? ""),
    resumeBook: me.materials?.resumeBook ?? false,
    races: answers?.raceEthnicity ?? [],
    gender: answers?.gender ?? "",
    firstGeneration: answers?.firstGeneration ?? "",
    lowIncome: answers?.lowIncome ?? "",
    lookingFor: me.interests?.lookingFor ?? [],
    hobbies: me.interests?.hobbies ?? [],
  };
}

// A pasted profile link becomes its name; typing keeps the member's own text.
export const typedName = (site: ProfileSite, value: string) => {
  const name = profileName(site, value);
  return name === value.trim() ? value.trimStart() : name;
};

const has = <T extends string>(options: readonly Option<T>[], value: string): value is T =>
  options.some((option) => option.value === value);

const PICKED: Partial<Record<Field, readonly Option<string>[]>> = {
  choice: PRONOUN_OPTIONS,
  standing: CLASS_STANDINGS,
  season: SEASONS,
  year: YEAR_OPTIONS,
  gpa: GPA_RANGES,
  gender: GENDERS,
  firstGeneration: YES_NO,
  lowIncome: YES_NO,
};

export function setField(d: Draft, key: string | undefined, value: string): Partial<Draft> | null {
  if (!isField(key) || typeof d[key] !== "string") return null;
  const options = PICKED[key];
  if (options && !has(options, value)) return null;
  const text = key === "linkedin" || key === "github" ? typedName(key, value) : value;
  return { [key]: text } as Partial<Draft>;
}

const toggled = <T>(list: readonly T[], value: T): T[] =>
  list.includes(value) ? list.filter((other) => other !== value) : [...list, value];

export function toggleField(
  d: Draft,
  key: string | undefined,
  value: string,
): Partial<Draft> | null {
  if (key === "races") return has(RACES, value) ? { races: toggleRace(d.races, value) } : null;
  if (key === "lookingFor") {
    return has(LOOKING_FOR, value) ? { lookingFor: toggled(d.lookingFor, value) } : null;
  }
  if (key === "hobbies") return has(HOBBIES, value) ? { hobbies: toggled(d.hobbies, value) } : null;
  return setField(d, key, value);
}

const RULES: { [F in Field]?: (d: Draft) => string | undefined } = {
  firstName: (d) => (d.firstName.trim() ? undefined : MESSAGES.firstName),
  lastName: (d) => (d.lastName.trim() ? undefined : MESSAGES.lastName),
  choice: (d) => (d.choice ? undefined : MESSAGES.pronouns),
  writeIn: (d) => (d.choice === SELF_DESCRIBE && !d.writeIn.trim() ? MESSAGES.writeIn : undefined),
  personalEmail: (d) => personalEmailError(d.personalEmail),
  phone: (d) => (isPhone(d.phone) ? undefined : MESSAGES.phone),
  standing: (d) => (d.standing ? undefined : MESSAGES.choose),
  major: (d) => (d.major.trim() ? undefined : MESSAGES.major),
  season: (d) => (d.season ? undefined : MESSAGES.term),
  year: (d) =>
    !d.year
      ? MESSAGES.gradYear
      : isGraduationYearAllowed(Number(d.year))
        ? undefined
        : MESSAGES.year,
  gpa: (d) => (d.gpa ? undefined : MESSAGES.choose),
  linkedin: (d) => profileError("linkedin", d.linkedin),
  github: (d) => profileError("github", d.github),
  races: (d) => (d.races.length ? undefined : MESSAGES.race),
  gender: (d) => (d.gender ? undefined : MESSAGES.choose),
  firstGeneration: (d) => (d.firstGeneration ? undefined : MESSAGES.choose),
  lowIncome: (d) => (d.lowIncome ? undefined : MESSAGES.choose),
};

export const errorsFor = (fields: readonly Field[], d: Draft) =>
  Object.fromEntries(fields.map((field) => [field, RULES[field]?.(d)])) as Partial<
    Record<Field, string>
  >;

export const passes = (fields: readonly Field[], d: Draft) =>
  Object.values(errorsFor(fields, d)).every((message) => !message);

type Args<F extends keyof typeof api.members> = FunctionArgs<(typeof api.members)[F]>;

type Payload = {
  name: Args<"saveName">;
  contact: Args<"saveContact">;
  studies: Args<"saveStudies">;
  materials: Args<"saveMaterials"> | { skip: true };
  interests: Args<"saveInterests"> | { skip: true };
  background: Args<"saveDemographics">;
};

const SKIP = { skip: true } as const;

const PAYLOAD: { [G in Group]: (d: Draft, me: Profile) => Payload[G] | null } = {
  name: (d) => ({
    firstName: d.firstName,
    lastName: d.lastName,
    pronouns: d.choice === SELF_DESCRIBE ? d.writeIn.trim() : d.choice,
  }),
  contact: (d) => ({ personalEmail: d.personalEmail, phone: d.phone }),
  studies: (d) =>
    d.standing && d.season && d.gpa
      ? {
          classStanding: d.standing,
          major: d.major,
          minor: d.minor.trim() || undefined,
          graduationSeason: d.season,
          graduationYear: Number(d.year),
          gpa: d.gpa,
        }
      : null,
  materials: (d, me) =>
    !d.linkedin.trim() && !d.github.trim() && !me.resume && !me.materials
      ? SKIP
      : {
          linkedin: d.linkedin.trim() || undefined,
          github: d.github.trim() || undefined,
          resumeBook: d.resumeBook && Boolean(me.resume),
        },
  interests: (d, me) =>
    d.lookingFor.length === 0 && d.hobbies.length === 0 && !me.interests
      ? SKIP
      : { lookingFor: d.lookingFor, hobbies: d.hobbies },
  background: (d) =>
    d.gender && d.firstGeneration && d.lowIncome
      ? {
          raceEthnicity: d.races,
          gender: d.gender,
          firstGeneration: d.firstGeneration,
          lowIncome: d.lowIncome,
        }
      : null,
};

export function useSave() {
  const saveName = useMutation(api.members.saveName);
  const saveContact = useMutation(api.members.saveContact);
  const saveStudies = useMutation(api.members.saveStudies);
  const saveMaterials = useMutation(api.members.saveMaterials);
  const saveDemographics = useMutation(api.members.saveDemographics);
  const saveInterests = useMutation(api.members.saveInterests);
  const skip = useMutation(api.members.skip);
  const send: { [G in Group]: (payload: Payload[G]) => Promise<null> } = {
    name: saveName,
    contact: saveContact,
    studies: saveStudies,
    materials: (payload) =>
      "skip" in payload ? skip({ group: "materials" }) : saveMaterials(payload),
    interests: (payload) =>
      "skip" in payload ? skip({ group: "interests" }) : saveInterests(payload),
    background: saveDemographics,
  };

  return async <G extends Group>(group: G, d: Draft, me: Profile) => {
    const payload = PAYLOAD[group](d, me);
    if (!payload) throw new ConvexError(MESSAGES.choose);
    await send[group](payload);
  };
}

export const failureText = (failure: unknown) =>
  failure instanceof ConvexError ? String(failure.data) : MESSAGES.failed;

export type Upload =
  | { ok: true; resume: { name: string; size: number } }
  | { ok: false; error: string };

export async function uploadResume(file: File): Promise<Upload> {
  if (file.type !== RESUME_CONTENT_TYPE) return { ok: false, error: MESSAGES.resumeType };
  if (file.size > RESUME_MAX_BYTES) return { ok: false, error: MESSAGES.resumeSize };
  try {
    const { data } = await authClient.convex.token({ fetchOptions: { throw: false } });
    if (!data?.token) return { ok: false, error: MESSAGES.uploadSignIn };

    const response = await fetch(
      `${env.VITE_CONVEX_SITE_URL}/resume?name=${encodeURIComponent(file.name)}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${data.token}`, "Content-Type": RESUME_CONTENT_TYPE },
        body: file,
      },
    );
    if (response.ok) return { ok: true, resume: await response.json() };
    return { ok: false, error: (await response.text()) || MESSAGES.uploadFailed };
  } catch {
    return { ok: false, error: MESSAGES.uploadFailed };
  }
}
