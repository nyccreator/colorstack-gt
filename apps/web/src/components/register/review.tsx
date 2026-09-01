import type { ReactNode } from "react";

import {
  AFFILIATIONS,
  CLASSIFICATIONS,
  COMMUNITIES,
  GENDERS,
  GPA_RANGES,
  RACE_ETHNICITIES,
  SEASONS,
  YES_NO_PRIVATE,
} from "./options";
import type { FormState } from "./state";

const EMPTY = "—";

function labelOf(options: readonly { value: string; label: string }[], value: string) {
  return value ? (options.find((option) => option.value === value)?.label ?? value) : EMPTY;
}

function or(value: string) {
  return value.trim() ? value : EMPTY;
}

function list(values: readonly string[]) {
  return values.length > 0 ? values.join(", ") : "None selected";
}

function Group({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-neutral-rule-cream py-5">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h4 className="type-label text-neutral-label-cream">{title}</h4>
        <button
          type="button"
          onClick={onEdit}
          className="cursor-pointer border-b border-gold text-detail font-semibold text-neutral-ink-navy"
        >
          Edit
        </button>
      </div>
      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[12rem_1fr]">{children}</dl>
    </section>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <>
      <dt className="text-detail text-neutral-body-cream sm:text-right">{label}</dt>
      <dd className="mb-2 text-item text-neutral-ink-navy sm:mb-0">{value}</dd>
    </>
  );
}

export function Review({
  form,
  onEdit,
}: {
  form: FormState;
  onEdit: (chapter: number, anchor: string) => void;
}) {
  const yesNo = (value: string) => (value === "yes" ? "Yes" : value === "no" ? "No" : EMPTY);
  const graduation =
    form.graduationSeason || form.graduationYear
      ? `${labelOf(SEASONS, form.graduationSeason)} ${form.graduationYear}`.trim()
      : EMPTY;

  return (
    <div className="mt-5 max-w-[82ch]">
      <div className="mb-6 rounded-content border border-gold/45 bg-neutral-cream-raised px-5 py-4">
        <p className="text-detail text-neutral-body-cream">We will send your sign-in link to</p>
        <p className="mt-1 text-subhead font-semibold break-all text-neutral-ink-navy">
          {form.gtEmail || "your Georgia Tech email"}
        </p>
      </div>

      <Group title="About you" onEdit={() => onEdit(1, "sec-contact")}>
        <Row label="Name" value={or(`${form.firstName} ${form.lastName}`)} />
        <Row label="Pronouns" value={or(form.pronouns)} />
        <Row label="Georgia Tech email" value={or(form.gtEmail)} />
        <Row label="Personal email" value={or(form.personalEmail)} />
        <Row label="Phone" value={or(form.phone)} />
        <Row label="Classification" value={labelOf(CLASSIFICATIONS, form.classification)} />
        <Row label="Graduating" value={graduation} />
        <Row label="GPA" value={labelOf(GPA_RANGES, form.gpa)} />
        <Row label="Major" value={or(form.major)} />
        <Row label="Minor" value={or(form.minor)} />
        <Row label="LinkedIn" value={or(form.linkedin)} />
        <Row label="GitHub" value={or(form.github)} />
        <Row label="Resume" value={form.resume ? form.resume.name : "Not attached"} />
        <Row label="Race &amp; ethnicity" value={labelOf(RACE_ETHNICITIES, form.raceEthnicity)} />
        <Row label="Gender" value={labelOf(GENDERS, form.gender)} />
        <Row label="First-generation" value={labelOf(YES_NO_PRIVATE, form.firstGeneration)} />
        <Row label="Low-income" value={labelOf(YES_NO_PRIVATE, form.lowIncome)} />
      </Group>

      <Group title="Your interests" onEdit={() => onEdit(2, "sec-affiliations")}>
        <Row
          label="Affiliations"
          value={list(form.affiliations.map((value) => labelOf(AFFILIATIONS, value)))}
        />
        <Row label="Interests" value={list(form.interests)} />
        <Row label="Social events" value={list(form.socialEvents)} />
      </Group>

      <Group title="Connections" onEdit={() => onEdit(3, "sec-connections")}>
        {COMMUNITIES.map((community) => (
          <Row key={community.key} label={community.linkLabel} value={yesNo(form[community.key])} />
        ))}
      </Group>

      <div className="border-t border-neutral-rule-cream pt-6">
        <p className="text-detail leading-copy text-neutral-body-cream">
          By submitting this form you authorize ColorStack at Georgia Tech to use this information
          to run the chapter, to report membership in aggregate to ColorStack nationally, to share
          your resume with partner companies, and to use your name and likeness in chapter
          promotion.
        </p>
      </div>
    </div>
  );
}
