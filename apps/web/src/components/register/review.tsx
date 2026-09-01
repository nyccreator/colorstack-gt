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

function labelOf(options: readonly { value: string; label: string }[], value: string) {
  return options.find((option) => option.value === value)?.label ?? value;
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
        <h3 className="type-label text-neutral-label-cream">{title}</h3>
        <button
          type="button"
          onClick={onEdit}
          className="cursor-pointer border-b border-gold text-detail font-semibold text-neutral-ink-navy"
        >
          Edit
        </button>
      </div>
      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">{children}</dl>
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

export function Review({ form, onEdit }: { form: FormState; onEdit: (step: number) => void }) {
  const yesNo = (value: string) => (value === "yes" ? "Yes" : "No");

  return (
    <div className="max-w-[68ch]">
      <div className="rounded-content border border-gold/45 bg-neutral-cream-raised px-5 py-4">
        <p className="text-detail text-neutral-body-cream">We will send your sign-in link to</p>
        <p className="mt-1 text-subhead font-semibold break-all text-neutral-ink-navy">
          {form.gtEmail || "your Georgia Tech email"}
        </p>
        <p className="mt-2 text-note leading-note text-neutral-body-cream">
          This is the only way into your account, so make sure it is right.
        </p>
      </div>

      <Group title="About you" onEdit={() => onEdit(1)}>
        <Row label="Name" value={`${form.firstName} ${form.lastName} (${form.pronouns})`} />
        <Row label="Personal email" value={form.personalEmail} />
        <Row label="Phone" value={form.phone} />
      </Group>

      <Group title="Your studies" onEdit={() => onEdit(2)}>
        <Row label="Classification" value={labelOf(CLASSIFICATIONS, form.classification)} />
        <Row
          label="Graduating"
          value={`${labelOf(SEASONS, form.graduationSeason)} ${form.graduationYear}`}
        />
        <Row label="GPA" value={labelOf(GPA_RANGES, form.gpa)} />
        <Row label="Major" value={form.major} />
        {form.minor ? <Row label="Minor" value={form.minor} /> : null}
      </Group>

      <Group title="Experience" onEdit={() => onEdit(3)}>
        <Row
          label="Affiliations"
          value={
            form.affiliations.length > 0
              ? form.affiliations.map((value) => labelOf(AFFILIATIONS, value)).join(", ")
              : "None selected"
          }
        />
        {form.linkedin ? <Row label="LinkedIn" value={form.linkedin} /> : null}
        {form.github ? <Row label="GitHub" value={form.github} /> : null}
        <Row label="Resume" value={form.resume ? form.resume.name : "Not attached"} />
      </Group>

      <Group title="What you want from ColorStack" onEdit={() => onEdit(4)}>
        <Row
          label="Interests"
          value={form.interests.length > 0 ? form.interests.join(", ") : "None selected"}
        />
        <Row
          label="Social events"
          value={form.socialEvents.length > 0 ? form.socialEvents.join(", ") : "None selected"}
        />
        {COMMUNITIES.map((community) => (
          <Row key={community.key} label={community.linkLabel} value={yesNo(form[community.key])} />
        ))}
      </Group>

      <Group title="Background" onEdit={() => onEdit(5)}>
        <Row label="Race &amp; ethnicity" value={labelOf(RACE_ETHNICITIES, form.raceEthnicity)} />
        <Row label="Gender" value={labelOf(GENDERS, form.gender)} />
        <Row label="First-generation" value={labelOf(YES_NO_PRIVATE, form.firstGeneration)} />
        <Row label="Low-income" value={labelOf(YES_NO_PRIVATE, form.lowIncome)} />
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
