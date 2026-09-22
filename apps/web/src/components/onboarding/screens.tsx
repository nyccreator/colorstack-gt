import { api } from "@colorstack-gt/backend/convex/_generated/api";
import {
  RESUME_CONTENT_TYPE,
  RESUME_MAX_BYTES,
  TEXT_MAX_LENGTH,
} from "@colorstack-gt/backend/convex/lib/config";
import { graduationYearOptions } from "@colorstack-gt/backend/convex/lib/graduation";
import {
  isEmail,
  isPhone,
  isProfileUrl,
  normalizeEmail,
} from "@colorstack-gt/backend/convex/lib/identity";
import { DEGREE_PROGRAMS, degreeLevel } from "@colorstack-gt/backend/convex/lib/programs";
import { env } from "@colorstack-gt/env/web";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";
import { type ReactNode, useState } from "react";

import { authClient } from "@/lib/auth-client";

import { Frame } from "../frame";
import { Heading } from "../heading";
import { Message } from "../message";
import { Chips, Field, Footbar, Group, Select } from "./controls";
import {
  type Answers,
  CLASS_STANDINGS,
  GENDERS,
  GPA_RANGES,
  HOBBIES,
  type Interests,
  LOOKING_FOR,
  PRONOUNS,
  RACES,
  SEASONS,
  SELF_DESCRIBE,
  STAGES,
  type Studies,
  YES_NO,
} from "./options";

export type Profile = NonNullable<FunctionReturnType<typeof api.members.me>>;

type ScreenProps = { me: Profile; onBack?: () => void; onNext: () => void };

type Forward = { label: string; onClick: () => void; disabled?: boolean };

const PRONOUN_OPTIONS = PRONOUNS.map((value) => ({ value, label: value }));

const YEAR_OPTIONS = graduationYearOptions().map((year) => ({
  value: String(year),
  label: String(year),
}));

function toggled<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function useSubmit() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<unknown>, then: () => void) {
    setPending(true);
    setError(null);
    try {
      await action();
      then();
    } catch (failure) {
      setError(
        failure instanceof ConvexError ? String(failure.data) : "Something went wrong. Try again.",
      );
    } finally {
      setPending(false);
    }
  }

  return { pending, error, run };
}

function Screen({
  index,
  title,
  onBack,
  forward,
  error,
  children,
}: {
  index: number;
  title: string;
  onBack?: () => void;
  forward: Forward;
  error: string | null;
  children: ReactNode;
}) {
  return (
    <Frame
      signOut
      anchor="high"
      rail={<Rail index={index} />}
      footer={<Footbar step={index} total={STAGES.length} onBack={onBack} forward={forward} />}
    >
      <Heading eyebrow={STAGES[index]?.title} title={title} size="step" />
      {children}
      {error ? <Message tone="error">{error}</Message> : null}
    </Frame>
  );
}

export function Rail({ index }: { index: number }) {
  return (
    <>
      <p aria-hidden className="type-display text-rail">
        {String(index + 1).padStart(2, "0")}
      </p>
      <p aria-hidden className="mt-2.5 type-micro text-diploma/64">
        of {String(STAGES.length).padStart(2, "0")}
      </p>
      <p aria-hidden className="mt-4 text-band-body text-burdell">
        {STAGES[index]?.title}
      </p>
    </>
  );
}

function Locked({ value, badge }: { value: string; badge: string }) {
  return (
    <div className="flex h-control items-center justify-between gap-4 rounded-full border border-diploma/26 bg-diploma/10 px-[clamp(14px,1.6vw,22px)] text-control text-diploma">
      <span className="min-w-0 truncate">{value}</span>
      <span className="flex-none type-micro text-burdell">{badge}</span>
    </div>
  );
}

function WhoYouAre({ me, onNext }: ScreenProps) {
  const save = useMutation(api.members.saveName);
  const { pending, error, run } = useSubmit();

  const saved = me.name?.pronouns ?? "";
  const listed = PRONOUNS.some((option) => option === saved && option !== SELF_DESCRIBE);

  const [firstName, setFirstName] = useState(me.name?.firstName ?? "");
  const [lastName, setLastName] = useState(me.name?.lastName ?? "");
  const [choice, setChoice] = useState(saved ? (listed ? saved : SELF_DESCRIBE) : "");
  const [writeIn, setWriteIn] = useState(listed ? "" : saved);

  const pronouns = choice === SELF_DESCRIBE ? writeIn.trim() : choice;
  const valid = Boolean(firstName.trim() && lastName.trim() && pronouns);

  return (
    <Screen
      index={0}
      title="Let's start with your name."
      error={error}
      forward={{
        label: "Continue",
        disabled: !valid || pending,
        onClick: () => run(() => save({ firstName, lastName, pronouns }), onNext),
      }}
    >
      <Field label="Name" htmlFor="first-name">
        <div className="grid grid-cols-1 gap-3.25 min-[400px]:grid-cols-2">
          <input
            id="first-name"
            maxLength={TEXT_MAX_LENGTH}
            autoComplete="given-name"
            placeholder="First"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
          />
          <input
            aria-label="Last name"
            maxLength={TEXT_MAX_LENGTH}
            autoComplete="family-name"
            placeholder="Last"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
          />
        </div>
      </Field>

      <Field label="Pronouns" htmlFor="pronouns">
        <div
          className={
            choice === SELF_DESCRIBE
              ? "grid grid-cols-1 gap-3.25 min-[400px]:grid-cols-2"
              : undefined
          }
        >
          <Select
            id="pronouns"
            value={choice}
            onChange={setChoice}
            options={PRONOUN_OPTIONS}
            placeholder="Choose"
          />
          {choice === SELF_DESCRIBE ? (
            <input
              aria-label="Your pronouns"
              maxLength={TEXT_MAX_LENGTH}
              placeholder="Your pronouns"
              value={writeIn}
              onChange={(event) => setWriteIn(event.target.value)}
            />
          ) : null}
        </div>
      </Field>
    </Screen>
  );
}

function HowWeReachYou({ me, onBack, onNext }: ScreenProps) {
  const save = useMutation(api.members.saveContact);
  const { pending, error, run } = useSubmit();

  const [personalEmail, setPersonalEmail] = useState(me.contact?.personalEmail ?? "");
  const [phone, setPhone] = useState(me.contact?.phone ?? "");
  const [touched, setTouched] = useState({ email: false, phone: false });

  const emailError = !isEmail(personalEmail)
    ? "Enter a valid email address."
    : normalizeEmail(personalEmail) === me.gtEmail
      ? "Use an address other than your Georgia Tech email."
      : undefined;
  const phoneError = isPhone(phone) ? undefined : "Enter a valid phone number.";
  const showEmailError = touched.email && personalEmail ? emailError : undefined;
  const showPhoneError = touched.phone && phone ? phoneError : undefined;

  return (
    <Screen
      index={1}
      title="Where should we reach you?"
      onBack={onBack}
      error={error}
      forward={{
        label: "Continue",
        disabled: Boolean(emailError || phoneError) || pending,
        onClick: () => run(() => save({ personalEmail, phone }), onNext),
      }}
    >
      <Group id="gt-email" label="Georgia Tech email">
        <Locked value={me.gtEmail} badge="Verified" />
      </Group>

      <Field label="Personal email" htmlFor="personal-email" error={showEmailError}>
        <input
          id="personal-email"
          maxLength={TEXT_MAX_LENGTH}
          type="email"
          inputMode="email"
          autoComplete="email"
          value={personalEmail}
          onChange={(event) => setPersonalEmail(event.target.value)}
          onBlur={() => setTouched((state) => ({ ...state, email: true }))}
          aria-invalid={showEmailError ? true : undefined}
          aria-describedby={showEmailError ? "personal-email-error" : undefined}
        />
      </Field>

      <Field label="Phone" htmlFor="phone" error={showPhoneError}>
        <input
          id="phone"
          maxLength={TEXT_MAX_LENGTH}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          onBlur={() => setTouched((state) => ({ ...state, phone: true }))}
          aria-invalid={showPhoneError ? true : undefined}
          aria-describedby={showPhoneError ? "phone-error" : undefined}
        />
      </Field>
    </Screen>
  );
}

function YouAtTech({ me, onBack, onNext }: ScreenProps) {
  const save = useMutation(api.members.saveStudies);
  const { pending, error, run } = useSubmit();
  const studies = me.studies;

  const [standing, setStanding] = useState<Studies["classStanding"] | "">(
    studies?.classStanding ?? "",
  );
  const [major, setMajor] = useState(studies?.major ?? "");
  const [minor, setMinor] = useState(studies?.minor ?? "");
  const [season, setSeason] = useState<Studies["graduationSeason"] | "">(
    studies?.graduationSeason ?? "",
  );
  const [year, setYear] = useState(studies ? String(studies.graduationYear) : "");
  const [gpa, setGpa] = useState<Studies["gpa"] | "">(studies?.gpa ?? "");

  const programs = standing ? DEGREE_PROGRAMS[degreeLevel(standing)] : [];
  const valid = Boolean(standing && major.trim() && season && year && gpa);

  function chooseStanding(next: Studies["classStanding"] | "") {
    if (standing && next && degreeLevel(next) !== degreeLevel(standing)) setMajor("");
    setStanding(next);
  }

  function submit() {
    if (!standing || !season || !gpa) return;
    void run(
      () =>
        save({
          classStanding: standing,
          major,
          minor: minor.trim() || undefined,
          graduationSeason: season,
          graduationYear: Number(year),
          gpa,
        }),
      onNext,
    );
  }

  return (
    <Screen
      index={2}
      title="You at Tech."
      onBack={onBack}
      error={error}
      forward={{ label: "Continue", disabled: !valid || pending, onClick: submit }}
    >
      <Field label="Class standing" htmlFor="standing">
        <Select
          id="standing"
          value={standing}
          onChange={chooseStanding}
          options={CLASS_STANDINGS}
          placeholder="Choose"
        />
      </Field>

      <Field label="Major" htmlFor="major">
        <input
          id="major"
          maxLength={TEXT_MAX_LENGTH}
          list="majors"
          autoComplete="off"
          disabled={!standing}
          placeholder={standing ? "Start typing" : "Choose your standing first"}
          value={major}
          onChange={(event) => setMajor(event.target.value)}
          className="disabled:cursor-not-allowed"
        />
        <datalist id="majors">
          {programs.map((program) => (
            <option key={program} value={program} />
          ))}
        </datalist>
      </Field>

      <Field label="Second major or minor" htmlFor="minor">
        <input
          id="minor"
          maxLength={TEXT_MAX_LENGTH}
          placeholder="Add one"
          value={minor}
          onChange={(event) => setMinor(event.target.value)}
        />
      </Field>

      <div className="grid max-w-form grid-cols-1 gap-x-3.25 sm:grid-cols-2">
        <Group id="graduation" label="Expected graduation">
          <div className="grid grid-cols-2 gap-3.25">
            <Select
              id="graduation-season"
              label="Graduation season"
              value={season}
              onChange={setSeason}
              options={SEASONS}
              placeholder="Season"
            />
            <Select
              id="graduation-year"
              label="Graduation year"
              value={year}
              onChange={setYear}
              options={YEAR_OPTIONS}
              placeholder="Year"
            />
          </div>
        </Group>
        <Field label="GPA range" htmlFor="gpa">
          <Select
            id="gpa"
            value={gpa}
            onChange={setGpa}
            options={GPA_RANGES}
            placeholder="Choose"
          />
        </Field>
      </div>
    </Screen>
  );
}

/** Sends the resume straight to the member's own row and returns an error to show, if any. */
async function uploadResume(file: File): Promise<string | null> {
  const { data } = await authClient.convex.token({ fetchOptions: { throw: false } });
  if (!data?.token) return "Sign in again to upload.";

  const response = await fetch(
    `${env.VITE_CONVEX_SITE_URL}/resume?name=${encodeURIComponent(file.name)}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${data.token}`, "Content-Type": RESUME_CONTENT_TYPE },
      body: file,
    },
  );
  if (response.ok) return null;
  return (await response.text()) || "Upload failed. Try again.";
}

function YourMaterials({ me, onBack, onNext }: ScreenProps) {
  const save = useMutation(api.members.saveMaterials);
  const skip = useMutation(api.members.skip);
  const { pending, error, run } = useSubmit();

  const [linkedin, setLinkedin] = useState(me.materials?.linkedin ?? "");
  const [github, setGithub] = useState(me.materials?.github ?? "");
  const [resumeBook, setResumeBook] = useState(me.materials?.resumeBook ?? false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const linkedinError =
    linkedin.trim() && !isProfileUrl(linkedin) ? "Enter a valid LinkedIn link." : undefined;
  const githubError =
    github.trim() && !isProfileUrl(github) ? "Enter a valid GitHub link." : undefined;
  const hasResume = Boolean(me.resume);
  const empty = !linkedin.trim() && !github.trim() && !hasResume;

  async function attach(file: File | undefined) {
    if (!file) return;
    if (file.type !== RESUME_CONTENT_TYPE) return setUploadError("Upload a PDF.");
    if (file.size > RESUME_MAX_BYTES) return setUploadError("Keep the file under 5MB.");
    setUploading(true);
    setUploadError(null);
    setUploadError(await uploadResume(file));
    setUploading(false);
  }

  const forward: Forward = empty
    ? { label: "Skip", disabled: pending, onClick: () => run(() => skip({ step: 4 }), onNext) }
    : {
        label: "Continue",
        disabled: pending || uploading || Boolean(linkedinError || githubError),
        onClick: () =>
          run(
            () =>
              save({
                linkedin: linkedin.trim() || undefined,
                github: github.trim() || undefined,
                resumeBook: resumeBook && hasResume,
              }),
            onNext,
          ),
      };

  return (
    <Screen
      index={3}
      title="Anything you'd like partner companies to see?"
      onBack={onBack}
      error={error}
      forward={forward}
    >
      <Field label="LinkedIn" htmlFor="linkedin" error={linkedinError}>
        <input
          id="linkedin"
          maxLength={TEXT_MAX_LENGTH}
          inputMode="url"
          autoComplete="url"
          placeholder="linkedin.com/in/"
          value={linkedin}
          onChange={(event) => setLinkedin(event.target.value)}
        />
      </Field>

      <Field label="GitHub" htmlFor="github" error={githubError}>
        <input
          id="github"
          maxLength={TEXT_MAX_LENGTH}
          inputMode="url"
          placeholder="github.com/"
          value={github}
          onChange={(event) => setGithub(event.target.value)}
        />
      </Field>

      <Field label="Resume" htmlFor="resume" error={uploadError ?? undefined}>
        <label
          htmlFor="resume"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            void attach(event.dataTransfer.files[0]);
          }}
          className="block cursor-pointer"
        >
          {me.resume ? (
            <Locked
              value={`${me.resume.name} · ${Math.round(me.resume.size / 1024)} KB`}
              badge={uploading ? "Uploading" : "Attached"}
            />
          ) : (
            <span className="flex h-[clamp(64px,9vh,82px)] items-center justify-center rounded-full border border-dashed border-diploma/26 text-note text-diploma/86 hover:border-burdell hover:text-burdell">
              {uploading ? "Uploading" : "Drop a PDF, or browse · 5MB max"}
            </span>
          )}
        </label>
        <input
          id="resume"
          type="file"
          accept={RESUME_CONTENT_TYPE}
          className="sr-only"
          onChange={(event) => void attach(event.target.files?.[0])}
        />
      </Field>

      <label className="mt-6 flex max-w-form cursor-pointer items-start gap-3.5 has-disabled:cursor-not-allowed">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={resumeBook && hasResume}
          disabled={!hasResume}
          onChange={(event) => setResumeBook(event.target.checked)}
        />
        <span className="text-note text-diploma/86">
          Include me in the resume book our partner companies see. You can switch this off any time.
        </span>
      </label>
    </Screen>
  );
}

function ReportForm({
  saved,
  onBack,
  onNext,
}: {
  saved: Answers | null;
  onBack?: () => void;
  onNext: () => void;
}) {
  const save = useMutation(api.members.saveDemographics);
  const { pending, error, run } = useSubmit();

  const [races, setRaces] = useState<Answers["raceEthnicity"]>(saved?.raceEthnicity ?? []);
  const [gender, setGender] = useState<Answers["gender"] | "">(saved?.gender ?? "");
  const [firstGeneration, setFirstGeneration] = useState<Answers["firstGeneration"] | "">(
    saved?.firstGeneration ?? "",
  );
  const [lowIncome, setLowIncome] = useState<Answers["lowIncome"] | "">(saved?.lowIncome ?? "");

  function toggleRace(value: Answers["raceEthnicity"][number]) {
    if (value === "prefer_not_to_answer") {
      setRaces(races.includes(value) ? [] : [value]);
      return;
    }
    const rest = races.filter((race) => race !== "prefer_not_to_answer");
    setRaces(rest.includes(value) ? rest.filter((race) => race !== value) : [...rest, value]);
  }

  function submit() {
    if (races.length === 0 || !gender || !firstGeneration || !lowIncome) return;
    void run(() => save({ raceEthnicity: races, gender, firstGeneration, lowIncome }), onNext);
  }

  const valid = races.length > 0 && gender && firstGeneration && lowIncome;

  return (
    <Screen
      index={4}
      title="A few questions we report on."
      onBack={onBack}
      error={error}
      forward={{ label: "Continue", disabled: !valid || pending, onClick: submit }}
    >
      <Group id="race" label="Race and ethnicity · all that apply">
        <Chips
          options={RACES}
          selected={races}
          onToggle={toggleRace}
          quiet="prefer_not_to_answer"
        />
      </Group>
      <Group id="gender" label="Gender">
        <Chips
          options={GENDERS}
          selected={gender ? [gender] : []}
          onToggle={setGender}
          quiet="prefer_not_to_answer"
        />
      </Group>
      <Group id="first-generation" label="First-generation college student">
        <Chips
          options={YES_NO}
          selected={firstGeneration ? [firstGeneration] : []}
          onToggle={setFirstGeneration}
          quiet="prefer_not_to_answer"
        />
      </Group>
      <Group id="low-income" label="Low-income background">
        <Chips
          options={YES_NO}
          selected={lowIncome ? [lowIncome] : []}
          onToggle={setLowIncome}
          quiet="prefer_not_to_answer"
        />
      </Group>
    </Screen>
  );
}

function ThePartWeReport({ onBack, onNext }: ScreenProps) {
  const saved = useQuery(api.members.myDemographics);
  if (saved === undefined) return <Frame signOut>{null}</Frame>;
  return <ReportForm saved={saved} onBack={onBack} onNext={onNext} />;
}

function WhatYoureHereFor({ me, onBack, onNext }: ScreenProps) {
  const save = useMutation(api.members.saveInterests);
  const skip = useMutation(api.members.skip);
  const { pending, error, run } = useSubmit();

  const [lookingFor, setLookingFor] = useState<Interests["lookingFor"]>(
    me.interests?.lookingFor ?? [],
  );
  const [hobbies, setHobbies] = useState<Interests["hobbies"]>(me.interests?.hobbies ?? []);
  const empty = lookingFor.length === 0 && hobbies.length === 0;

  return (
    <Screen
      index={5}
      title="What brings you here?"
      onBack={onBack}
      error={error}
      forward={
        empty
          ? {
              label: "Skip",
              disabled: pending,
              onClick: () => run(() => skip({ step: 6 }), onNext),
            }
          : {
              label: "Continue",
              disabled: pending,
              onClick: () => run(() => save({ lookingFor, hobbies }), onNext),
            }
      }
    >
      <Group id="looking-for" label="What you're looking for">
        <Chips
          options={LOOKING_FOR}
          selected={lookingFor}
          onToggle={(value) => setLookingFor(toggled(lookingFor, value))}
        />
      </Group>
      <Group id="hobbies" label="Hobbies and interests">
        <Chips
          options={HOBBIES}
          selected={hobbies}
          onToggle={(value) => setHobbies(toggled(hobbies, value))}
        />
      </Group>
    </Screen>
  );
}

export const SCREENS = [
  WhoYouAre,
  HowWeReachYou,
  YouAtTech,
  YourMaterials,
  ThePartWeReport,
  WhatYoureHereFor,
] as const;
