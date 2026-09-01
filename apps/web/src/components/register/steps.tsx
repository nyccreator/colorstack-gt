import { graduationYearOptions } from "@colorstack-gt/backend/convex/lib/graduation";

import { Chip, Field, FieldGroup, Select, TextInput } from "./fields";
import {
  AFFILIATIONS,
  CLASSIFICATIONS,
  COMMUNITIES,
  GENDERS,
  GPA_RANGES,
  INTERESTS,
  RACE_ETHNICITIES,
  SEASONS,
  SOCIAL_EVENTS,
  YES_NO,
  YES_NO_PRIVATE,
} from "./options";
import { type Errors, type FormState, toggleValue } from "./state";

const YEARS = graduationYearOptions().map((year) => ({
  value: String(year),
  label: String(year),
}));

type StepProps = {
  form: FormState;
  errors: Errors;
  set: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
};

const grid = "grid gap-x-6 gap-y-6 sm:grid-cols-2";

export function AboutYou({ form, errors, set }: StepProps) {
  return (
    <div className={grid}>
      <Field id="first-name" label="First name" required error={errors.firstName}>
        <TextInput
          id="first-name"
          required
          error={errors.firstName}
          value={form.firstName}
          autoComplete="given-name"
          placeholder="John"
          onChange={(e) => set("firstName", e.target.value)}
        />
      </Field>
      <Field id="last-name" label="Last name" required error={errors.lastName}>
        <TextInput
          id="last-name"
          required
          error={errors.lastName}
          value={form.lastName}
          autoComplete="family-name"
          placeholder="Doe"
          onChange={(e) => set("lastName", e.target.value)}
        />
      </Field>
      <Field id="gt-email" label="Georgia Tech email" required error={errors.gtEmail}>
        <TextInput
          id="gt-email"
          type="email"
          required
          error={errors.gtEmail}
          value={form.gtEmail}
          autoComplete="username"
          placeholder="jdoe3@gatech.edu"
          onChange={(e) => set("gtEmail", e.target.value)}
        />
      </Field>
      <Field id="personal-email" label="Personal email" required error={errors.personalEmail}>
        <TextInput
          id="personal-email"
          type="email"
          required
          error={errors.personalEmail}
          value={form.personalEmail}
          autoComplete="email"
          placeholder="john.doe@gmail.com"
          onChange={(e) => set("personalEmail", e.target.value)}
        />
      </Field>
      <Field id="pronouns" label="Pronouns" required error={errors.pronouns}>
        <TextInput
          id="pronouns"
          required
          error={errors.pronouns}
          value={form.pronouns}
          placeholder="he/him"
          onChange={(e) => set("pronouns", e.target.value)}
        />
      </Field>
      <Field id="phone" label="Phone" required error={errors.phone}>
        <TextInput
          id="phone"
          type="tel"
          required
          error={errors.phone}
          value={form.phone}
          autoComplete="tel"
          placeholder="(404) 555-0100"
          onChange={(e) => set("phone", e.target.value)}
        />
      </Field>
    </div>
  );
}

export function YourStudies({ form, errors, set }: StepProps) {
  const graduation = errors.graduationSeason ?? errors.graduationYear;

  return (
    <>
      <div className={grid}>
        <Field id="classification" label="Classification" required error={errors.classification}>
          <Select
            id="classification"
            required
            error={errors.classification}
            placeholder="Select"
            options={CLASSIFICATIONS}
            value={form.classification}
            onChange={(e) => set("classification", e.target.value)}
          />
        </Field>
        <FieldGroup id="graduation" label="Expected graduation" required error={graduation}>
          <div className="grid grid-cols-2 gap-x-4">
            <Select
              id="grad-season"
              aria-label="Graduation season"
              required
              error={errors.graduationSeason}
              placeholder="Season"
              options={SEASONS}
              value={form.graduationSeason}
              onChange={(e) => set("graduationSeason", e.target.value)}
            />
            <Select
              id="grad-year"
              aria-label="Graduation year"
              required
              error={errors.graduationYear}
              placeholder="Year"
              options={YEARS}
              value={form.graduationYear}
              onChange={(e) => set("graduationYear", e.target.value)}
            />
          </div>
        </FieldGroup>
      </div>

      <div className="mt-6 grid gap-x-6 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
        <Field id="gpa" label="GPA" required error={errors.gpa}>
          <Select
            id="gpa"
            required
            error={errors.gpa}
            placeholder="Select"
            options={GPA_RANGES}
            value={form.gpa}
            onChange={(e) => set("gpa", e.target.value)}
          />
        </Field>
        <Field id="major" label="Major" required error={errors.major}>
          <TextInput
            id="major"
            required
            error={errors.major}
            value={form.major}
            placeholder="Computer Science"
            onChange={(e) => set("major", e.target.value)}
          />
        </Field>
        <Field id="minor" label="Minor or second major">
          <TextInput
            id="minor"
            value={form.minor}
            placeholder="Optional"
            onChange={(e) => set("minor", e.target.value)}
          />
        </Field>
      </div>
    </>
  );
}

export function Experience({ form, errors, set }: StepProps) {
  return (
    <>
      <FieldGroup
        id="affiliations"
        label="Other affiliations"
        hint="Pick any you are part of."
        className="mb-8"
      >
        <div className="flex flex-wrap gap-3">
          {AFFILIATIONS.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              selected={form.affiliations.includes(option.value)}
              onToggle={() => set("affiliations", toggleValue(form.affiliations, option.value))}
            />
          ))}
        </div>
      </FieldGroup>

      <div className={grid}>
        <Field id="linkedin" label="LinkedIn" error={errors.linkedin}>
          <TextInput
            id="linkedin"
            error={errors.linkedin}
            value={form.linkedin}
            placeholder="linkedin.com/in/johndoe"
            onChange={(e) => set("linkedin", e.target.value)}
          />
        </Field>
        <Field id="github" label="GitHub" error={errors.github}>
          <TextInput
            id="github"
            error={errors.github}
            value={form.github}
            placeholder="github.com/johndoe"
            onChange={(e) => set("github", e.target.value)}
          />
        </Field>
      </div>

      <Field id="resume" label="Resume &#183; PDF" error={errors.resume} className="mt-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-content border border-dashed border-neutral-border-dashed bg-neutral-cream-raised px-5 py-4">
          <span className="text-small text-neutral-body-cream">
            {form.resume ? form.resume.name : "Attach a PDF"}
          </span>
          <label
            htmlFor="resume"
            className="cursor-pointer border-b border-gold text-detail font-semibold text-neutral-ink-navy"
          >
            {form.resume ? "Choose a different file" : "Choose from your device"}
          </label>
          <input
            id="resume"
            type="file"
            accept="application/pdf"
            className="sr-only"
            onChange={(e) => set("resume", e.target.files?.[0] ?? null)}
          />
          {form.resume ? (
            <button
              type="button"
              onClick={() => set("resume", null)}
              className="cursor-pointer text-detail text-neutral-body-cream underline"
            >
              Remove
            </button>
          ) : null}
        </div>
      </Field>
    </>
  );
}

export function WhatYouWant({ form, errors, set }: StepProps) {
  return (
    <>
      <FieldGroup id="interests" label="What are you looking for" hint="Pick as many as apply.">
        <div className="flex flex-wrap gap-3">
          {INTERESTS.map((label) => (
            <Chip
              key={label}
              label={label}
              selected={form.interests.includes(label)}
              onToggle={() => set("interests", toggleValue(form.interests, label))}
            />
          ))}
        </div>
      </FieldGroup>

      <FieldGroup
        id="socialEvents"
        label="Social events you would come to"
        hint="Pick anything you would show up for. It tells the e-board what to plan."
        className="mt-8"
      >
        <div className="flex flex-wrap gap-3">
          {SOCIAL_EVENTS.map((label) => (
            <Chip
              key={label}
              label={label}
              selected={form.socialEvents.includes(label)}
              onToggle={() => set("socialEvents", toggleValue(form.socialEvents, label))}
            />
          ))}
        </div>
      </FieldGroup>

      <div className={`mt-9 ${grid}`}>
        {COMMUNITIES.map((community) => (
          <Field
            key={community.key}
            id={community.key}
            label={community.label}
            required
            error={errors[community.key]}
          >
            <Select
              id={community.key}
              required
              error={errors[community.key]}
              placeholder="Select"
              options={YES_NO}
              value={form[community.key]}
              onChange={(e) => set(community.key, e.target.value)}
            />
            <a
              href={community.href}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block border-b border-gold text-detail font-semibold text-neutral-ink-navy"
            >
              {community.linkLabel} &#8594;
            </a>
          </Field>
        ))}
      </div>
    </>
  );
}

export function Background({ form, errors, set }: StepProps) {
  return (
    <div className={grid}>
      <Field id="race" label="Race &amp; ethnicity" required error={errors.raceEthnicity}>
        <Select
          id="race"
          required
          error={errors.raceEthnicity}
          placeholder="Select"
          options={RACE_ETHNICITIES}
          value={form.raceEthnicity}
          onChange={(e) => set("raceEthnicity", e.target.value)}
        />
      </Field>
      <Field id="gender" label="Gender" required error={errors.gender}>
        <Select
          id="gender"
          required
          error={errors.gender}
          placeholder="Select"
          options={GENDERS}
          value={form.gender}
          onChange={(e) => set("gender", e.target.value)}
        />
      </Field>
      <Field
        id="first-gen"
        label="First-generation college student"
        required
        error={errors.firstGeneration}
      >
        <Select
          id="first-gen"
          required
          error={errors.firstGeneration}
          placeholder="Select"
          options={YES_NO_PRIVATE}
          value={form.firstGeneration}
          onChange={(e) => set("firstGeneration", e.target.value)}
        />
      </Field>
      <Field id="low-income" label="Low-income background" required error={errors.lowIncome}>
        <Select
          id="low-income"
          required
          error={errors.lowIncome}
          placeholder="Select"
          options={YES_NO_PRIVATE}
          value={form.lowIncome}
          onChange={(e) => set("lowIncome", e.target.value)}
        />
      </Field>
    </div>
  );
}
