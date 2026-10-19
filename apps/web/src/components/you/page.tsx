import { api } from "@colorstack-gt/backend/convex/_generated/api";
import { TEXT_MAX_LENGTH } from "@colorstack-gt/backend/convex/lib/config";
import { PREFER_NOT } from "@colorstack-gt/backend/convex/lib/demographics";
import { type Group, GROUPS } from "@colorstack-gt/backend/convex/lib/groups";
import { profileName, type ProfileSite } from "@colorstack-gt/backend/convex/lib/identity";
import { RESUME_LIMIT } from "@colorstack-gt/backend/convex/lib/messages";
import { DEGREE_PROGRAMS, degreeLevel } from "@colorstack-gt/backend/convex/lib/programs";
import { useBlocker } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import type { Answers, Profile } from "@/lib/member";

import { Bar, mayLeave, Pages } from "../frame";
import {
  type Draft,
  draftFrom,
  errorsFor,
  type Field as Key,
  uploadResume,
  useSave,
} from "../member/draft";
import { type Editor as Eid, GROUP_OF, TITLES } from "../member/groups";
import { breaks, few } from "../member/summary";
import { TaskLink } from "../member/task-link";
import { ErrorBadge } from "../message";
import { Prefixed } from "../onboarding/controls";
import {
  CLASS_STANDINGS,
  GENDERS,
  GPA_RANGES,
  HOBBIES,
  labelOf,
  labelsOf,
  LOOKING_FOR,
  type Option,
  PRONOUN_OPTIONS,
  RACES,
  SEASONS,
  SELF_DESCRIBE,
  YEAR_OPTIONS,
  YES_NO,
} from "../onboarding/options";
import { MemberCard } from "./card";
import { createEditing, type Ed, type EditorDef, type Res, type Row } from "./editing";

type Text = { [K in Key]: Draft[K] extends string ? K : never }[Key];
type GroupView = { note?: string; rows: (m: Profile) => Row[] };

const PRIVACY =
  "Only used in the totals we report. Never on your profile or shared with companies.";
const BOOK = [
  { value: "in", label: "Included" },
  { value: "out", label: "Not included" },
] as const;
// These are each destination's official logos and stay unaltered.
const SHORT = {
  national: { label: "National", logo: "/assets/logos/colorstack-national.png" },
  whatsapp: { label: "WhatsApp", logo: "/assets/logos/whatsapp.svg" },
  instagram: { label: "Instagram", logo: "/assets/logos/instagram.png" },
} as const;
const LEAD: Partial<Record<Eid, string>> = {
  background: PRIVACY,
  resume: "Changes here apply right away.",
};
const LABEL = {
  firstName: "First name",
  lastName: "Last name",
  choice: "Pronouns",
  writeIn: "Your pronouns",
  personalEmail: "Personal email",
  phone: "Phone",
  standing: "Class standing",
  major: "Major",
  minor: "Second major or minor",
  season: "Graduation season",
  year: "Graduation year",
  gpa: "GPA range",
  linkedin: "LinkedIn",
  github: "GitHub",
  resumeBook: "Resume book",
  races: "Race and ethnicity",
  gender: "Gender",
  firstGeneration: "First-generation college student",
  lowIncome: "Low-income background",
  lookingFor: "What you're looking for",
  hobbies: "Hobbies and interests",
} satisfies Record<Key, string>;

const size = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const of = (editor: Eid, rows: Omit<Row, "editor">[]): Row[] =>
  rows.map((row) => ({ ...row, editor }));

const GROUP: Record<Group, GroupView> = {
  name: {
    rows: (m) =>
      of("name", [
        {
          key: "name",
          label: "Name",
          value: m.name ? `${m.name.firstName} ${m.name.lastName}` : "",
        },
        { key: "pronouns", label: LABEL.choice, value: m.name?.pronouns ?? "" },
      ]),
  },
  contact: {
    rows: (m) =>
      of("contact", [
        { key: "gt", label: "Georgia Tech email", value: m.gtEmail, fixed: true },
        { key: "email", label: LABEL.personalEmail, value: m.contact?.personalEmail ?? "" },
        { key: "phone", label: LABEL.phone, value: m.contact?.phone ?? "" },
      ]),
  },
  studies: {
    rows: ({ studies: s }) =>
      of("studies", [
        {
          key: "standing",
          label: LABEL.standing,
          value: labelOf(CLASS_STANDINGS, s?.classStanding),
        },
        { key: "major", label: LABEL.major, value: s?.major ?? "" },
        { key: "minor", label: LABEL.minor, value: s?.minor ?? "" },
        {
          key: "grad",
          label: "Expected graduation",
          value: s ? `${labelOf(SEASONS, s.graduationSeason)} ${s.graduationYear}` : "",
        },
        { key: "gpa", label: LABEL.gpa, value: labelOf(GPA_RANGES, s?.gpa) },
      ]),
  },
  materials: {
    rows: (m) => [
      ...of("resume", [
        { key: "resume", label: "Resume", value: m.resume?.name ?? "" },
        {
          key: "book",
          label: LABEL.resumeBook,
          value: m.resume && m.materials?.resumeBook ? "Included" : "Not included",
        },
      ]),
      ...of("links", [
        {
          key: "linkedin",
          label: LABEL.linkedin,
          value: profileName("linkedin", m.materials?.linkedin ?? ""),
        },
        {
          key: "github",
          label: LABEL.github,
          value: profileName("github", m.materials?.github ?? ""),
        },
      ]),
    ],
  },
  interests: {
    rows: (m) =>
      of("interests", [
        {
          key: "looking",
          label: LABEL.lookingFor,
          value: few(labelsOf(LOOKING_FOR, m.interests?.lookingFor)),
        },
        {
          key: "hobbies",
          label: LABEL.hobbies,
          value: few(labelsOf(HOBBIES, m.interests?.hobbies)),
        },
      ]),
  },
  background: {
    note: PRIVACY,
    rows: (m) =>
      of("background", [
        {
          key: "answers",
          label: "Your answers",
          value: m.saved.background ? "Saved privately" : "",
        },
      ]),
  },
};

const EDITORS: Record<Eid, EditorDef> = {
  name: {
    focus: { name: "#firstName", pronouns: "#choice" },
    change: (k, d) => {
      if (k === "choice" && d.choice === SELF_DESCRIBE) return { focus: "#writeIn" };
    },
    fields: ["firstName", "lastName", "writeIn"],
  },
  contact: {
    focus: { email: "#personalEmail", phone: "#phone" },
    fields: ["personalEmail", "phone"],
  },
  studies: {
    focus: {
      standing: "#standing",
      major: "#major",
      minor: "#minor",
      grad: "#season",
      gpa: "#gpa",
    },
    // A new degree level has its own majors, so the typed one goes.
    change: (k, d, prev) => {
      if (k === "standing" && d.standing && prev.standing && level(d) !== level(prev)) {
        return { patch: { major: "" } };
      }
    },
    fields: ["major", "year"],
  },
  links: {
    focus: { linkedin: "#linkedin", github: "#github" },
    fields: ["linkedin", "github"],
  },
  interests: {
    chips: true,
    focus: { looking: '[data-chips="lookingFor"] .chip', hobbies: '[data-chips="hobbies"] .chip' },
    fields: [],
  },
  background: {
    chips: true,
    focus: { answers: "#h-background" },
    fields: ["races", "gender", "firstGeneration", "lowIncome"],
  },
  resume: {
    instant: true,
    focus: { resume: "#replace", book: '[data-chips="book"] .chip[aria-checked="true"]' },
    fields: [],
  },
};

const level = (d: Draft) => (d.standing ? degreeLevel(d.standing) : "bachelors");

export function YouPage({ me, answers }: { me: Profile; answers: Answers | null }) {
  const resumeUrl = useQuery(api.members.resumeUrl, me.resume ? {} : "skip");
  const save = useSave();
  const removeResume = useMutation(api.members.removeResume);
  const root = useRef<HTMLDivElement>(null);
  const latest = useRef({ me, answers, save });
  // oxlint-disable-next-line react/refs -- The controller's callbacks must read the newest props, and its state is not React's.
  latest.current = { me, answers, save };
  // oxlint-disable-next-line react/refs -- The controller's callbacks read the ref later, never during render.
  const [controller] = useState(() =>
    createEditing({
      rows: (group) => GROUP[group].rows(latest.current.me),
      editors: EDITORS,
      draft: () => draftFrom(latest.current.me, latest.current.answers),
      save: (editor, d) => latest.current.save(GROUP_OF[editor], d, latest.current.me),
      setBook: (on) => {
        const { me, answers, save } = latest.current;
        return save("materials", { ...draftFrom(me, answers), resumeBook: on }, me);
      },
      upload: uploadResume,
      removeResume,
      resume: () => latest.current.me.resume,
      inBook: () => Boolean(latest.current.me.resume && latest.current.me.materials?.resumeBook),
    }),
  );
  useSyncExternalStore(controller.subscribe, controller.version, () => 0);
  const { ed, res, lastOpen } = controller.state();

  const unsaved = controller.unsaved;
  const blocks = useCallback(() => !mayLeave(unsaved), [unsaved]);
  useBlocker({ shouldBlockFn: blocks, enableBeforeUnload: unsaved });

  useEffect(() => {
    controller.start(root.current!);
    window.scrollTo(0, 0);
    return () => controller.stop();
  }, [controller]);

  return (
    <div ref={root} className="you">
      <Bar signOut unsaved={unsaved} nav={<Pages />} className="bar" />
      <main>
        <h1 className="sr-only">You</h1>
        <div className="lb">
          <div className="side">
            <MemberCard me={me} />
            <div className="stay">
              <h2 className="kick" id="stay-h">
                Stay connected
              </h2>
              <ul className="links" aria-labelledby="stay-h">
                {(Object.keys(SHORT) as (keyof typeof SHORT)[]).map((task) => (
                  <li key={task}>
                    <TaskLink task={task} logo={SHORT[task].logo} short={SHORT[task].label} />
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="groups">
            {GROUPS.map((group) => (
              <GroupView
                key={group}
                group={group}
                me={me}
                ed={ed}
                res={res}
                resumeUrl={resumeUrl ?? undefined}
              />
            ))}
          </div>
        </div>
        <button type="button" className="back">
          <span>Back to {TITLES[lastOpen].toLowerCase()}</span>
          <i className="ic" aria-hidden />
        </button>
      </main>
      <Pages dock />
      <p id="you-status" className="sr-only" role="status" />
    </div>
  );
}

function RowView({ row }: { row: Row }) {
  if (row.fixed) {
    return (
      <div className="row locked" data-row={row.key}>
        <span className="k">{row.label}</span>
        <span className="v">{breaks(row.value)}</span>
        <span className="why">You sign in with this, so it can't change.</span>
      </div>
    );
  }
  return (
    <button
      type="button"
      className="row"
      data-row={row.key}
      aria-label={row.value ? `Edit ${row.label}, ${row.value}` : `Add ${row.label}`}
    >
      <span className="k">{row.label}</span>
      <span className={row.value ? "v" : "v add"}>{row.value ? breaks(row.value) : "Add"}</span>
      <i className="ic tick ok" hidden />
      <i className="ic chev" />
    </button>
  );
}

function GroupView({
  group,
  me,
  ed,
  res,
  resumeUrl,
}: {
  group: Group;
  me: Profile;
  ed: Ed | null;
  res: Res;
  resumeUrl?: string | null;
}) {
  const open = ed?.group === group ? ed : null;
  const rows = GROUP[group].rows(me);
  const editors = [...new Set(rows.map((row) => row.editor))];
  const views = (list: Row[]) => list.map((row) => <RowView key={row.key} row={row} />);
  const form = open ? (
    <Editor ed={open} me={me} res={res} editor={EDITORS[open.editor]} resumeUrl={resumeUrl} />
  ) : null;

  return (
    <section className={open ? "grp open" : "grp"} id={`g-${group}`} aria-labelledby={`h-${group}`}>
      <div className="gh">
        <h2 id={`h-${group}`} tabIndex={-1}>
          {TITLES[group]}
        </h2>
      </div>
      <div className="gp">
        {editors.length > 1
          ? editors.map((editor) => (
              <div
                key={editor}
                className={open && open.editor !== editor ? "sub off" : "sub"}
                data-sub={editor}
              >
                {open?.editor === editor
                  ? form
                  : views(rows.filter((row) => row.editor === editor))}
              </div>
            ))
          : (form ?? views(rows))}
      </div>
      {GROUP[group].note ? <p className="pv">{GROUP[group].note}</p> : null}
    </section>
  );
}

function Field({
  keys,
  label,
  sub,
  id,
  group,
  tall,
  radio,
  error,
  children,
}: {
  keys: readonly string[];
  label: string;
  sub?: string;
  id?: string;
  group?: string;
  tall?: boolean;
  radio?: boolean;
  error?: string;
  children: ReactNode;
}) {
  const named = group && !radio;
  const errorId = `${keys[0]}-error`;
  const text = sub ? (
    <>
      {label} <span className="ks">{sub}</span>
    </>
  ) : (
    label
  );
  return (
    <div className={tall ? "f tall" : "f"} data-keys={keys.join(" ")}>
      {group ? (
        <span className="k" id={`${group}-label`}>
          {text}
        </span>
      ) : (
        <label className="k" htmlFor={id}>
          {text}
        </label>
      )}
      <div
        className="ctl"
        role={named ? "group" : undefined}
        aria-labelledby={named ? `${group}-label` : undefined}
        aria-describedby={named && error ? errorId : undefined}
      >
        {children}
      </div>
      <p className="err" id={errorId} hidden={!error}>
        {error ? (
          <>
            <ErrorBadge />
            <span>{error}</span>
          </>
        ) : null}
      </p>
    </div>
  );
}

function ChipSet({
  k,
  options,
  on,
  quiet,
  disabled,
  radio,
  invalid,
}: {
  k: string;
  options: readonly Option<string>[];
  on: readonly string[];
  quiet?: string;
  disabled?: boolean;
  radio?: string;
  invalid?: boolean;
}) {
  const any = options.some((option) => on.includes(option.value));
  return (
    <div
      className="chips"
      data-chips={k}
      role={radio ? "radiogroup" : undefined}
      aria-labelledby={radio ? `${radio}-label` : undefined}
      aria-describedby={radio && invalid ? `${k}-error` : undefined}
      aria-invalid={(radio && invalid) || undefined}
    >
      {options.map((option, i) => {
        const selected = on.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            className={option.value === quiet ? "chip quiet" : "chip"}
            data-v={option.value}
            disabled={disabled}
            {...(radio
              ? {
                  role: "radio",
                  "aria-checked": selected,
                  tabIndex: selected || (!any && i === 0) ? 0 : -1,
                }
              : { "aria-pressed": selected })}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function Editor({
  ed,
  me,
  res,
  editor,
  resumeUrl,
}: {
  ed: Ed;
  me: Profile;
  res: Res;
  editor: EditorDef;
  resumeUrl?: string | null;
}) {
  const d = ed.draft;
  const errors: Partial<Record<string, string>> = errorsFor(editor.fields, d);
  const error = (keys: readonly string[]) => {
    const k = keys.find((x) => ed.shown.has(x));
    return k ? errors[k] : undefined;
  };
  const control = (k: Key, block: Key = k) => ({
    id: k,
    "data-k": k,
    "aria-invalid": ed.shown.has(k) || undefined,
    "aria-describedby": ed.shown.has(k) ? `${block}-error` : undefined,
  });
  const text = (k: Text, block: Key = k, last = true) => ({
    ...control(k, block),
    defaultValue: d[k],
    maxLength: TEXT_MAX_LENGTH,
    enterKeyHint: last ? ("done" as const) : ("next" as const),
    readOnly: ed.busy,
  });
  const link = (site: ProfileSite, last = true) => ({
    ...text(site, site, last),
    autoCapitalize: "none",
    autoCorrect: "off",
    spellCheck: false,
    onInput: (event: FormEvent<HTMLInputElement>) => {
      const el = event.currentTarget;
      const name = profileName(site, el.value);
      if (name !== el.value.trim()) el.value = name;
    },
  });
  const select = (k: Text, options: readonly Option<string>[], block: Key = k) => (
    <select {...control(k, block)} defaultValue={d[k]}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );

  let fields: ReactNode = null;
  switch (ed.editor) {
    case "name":
      fields = (
        <>
          <Field
            keys={["firstName", "lastName"]}
            label="Name"
            id="firstName"
            error={error(["firstName", "lastName"])}
          >
            <div className="pair">
              <input
                {...text("firstName", "firstName", false)}
                autoComplete="given-name"
                placeholder="First"
                aria-label={LABEL.firstName}
              />
              <input
                {...text("lastName", "firstName")}
                autoComplete="family-name"
                placeholder="Last"
                aria-label={LABEL.lastName}
              />
            </div>
          </Field>
          <Field
            keys={["choice", "writeIn"]}
            label={LABEL.choice}
            id="choice"
            error={error(["choice", "writeIn"])}
          >
            <div className={d.choice === SELF_DESCRIBE ? "pair" : undefined}>
              {select("choice", PRONOUN_OPTIONS)}
              {d.choice === SELF_DESCRIBE ? (
                <input
                  {...text("writeIn", "choice")}
                  aria-label={LABEL.writeIn}
                  placeholder={LABEL.writeIn}
                />
              ) : null}
            </div>
          </Field>
        </>
      );
      break;
    case "contact":
      fields = (
        <>
          <RowView
            row={{
              key: "gt",
              label: "Georgia Tech email",
              value: me.gtEmail,
              fixed: true,
              editor: "contact",
            }}
          />
          <Field
            keys={["personalEmail"]}
            label={LABEL.personalEmail}
            id="personalEmail"
            error={error(["personalEmail"])}
          >
            <input
              {...text("personalEmail", "personalEmail", false)}
              type="email"
              inputMode="email"
              autoComplete="email"
            />
          </Field>
          <Field keys={["phone"]} label={LABEL.phone} id="phone" error={error(["phone"])}>
            <input {...text("phone")} type="tel" inputMode="tel" autoComplete="tel" />
          </Field>
        </>
      );
      break;
    case "studies": {
      const years = YEAR_OPTIONS.some((option) => option.value === d.year)
        ? YEAR_OPTIONS
        : [...YEAR_OPTIONS, { value: d.year, label: d.year }];
      fields = (
        <>
          <Field keys={["standing"]} label={LABEL.standing} id="standing">
            {select("standing", CLASS_STANDINGS)}
          </Field>
          <Field keys={["major"]} label={LABEL.major} id="major" error={error(["major"])}>
            <input
              key={level(d)}
              {...text("major", "major", false)}
              list="majors"
              autoComplete="off"
              placeholder="Start typing"
            />
            <datalist id="majors">
              {DEGREE_PROGRAMS[level(d)].map((program) => (
                <option key={program} value={program} />
              ))}
            </datalist>
          </Field>
          <Field keys={["minor"]} label={LABEL.minor} id="minor">
            <input {...text("minor")} placeholder="Add one" />
          </Field>
          <Field
            keys={["season", "year"]}
            label="Expected graduation"
            group="grad"
            error={error(["season", "year"])}
          >
            <div className="pair">
              <select {...control("season")} aria-label={LABEL.season} defaultValue={d.season}>
                {SEASONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select {...control("year", "season")} aria-label={LABEL.year} defaultValue={d.year}>
                {years.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </Field>
          <Field keys={["gpa"]} label={LABEL.gpa} id="gpa">
            {select("gpa", GPA_RANGES)}
          </Field>
        </>
      );
      break;
    }
    case "links":
      fields = (
        <>
          <Field
            keys={["linkedin"]}
            label={LABEL.linkedin}
            id="linkedin"
            error={error(["linkedin"])}
          >
            <Prefixed prefix="linkedin.com/in/" {...link("linkedin", false)} />
          </Field>
          <Field keys={["github"]} label={LABEL.github} id="github" error={error(["github"])}>
            <Prefixed prefix="github.com/" {...link("github")} />
          </Field>
        </>
      );
      break;
    case "interests":
      fields = (
        <>
          <Field keys={["lookingFor"]} label={LABEL.lookingFor} group="lookingFor" tall>
            <ChipSet k="lookingFor" options={LOOKING_FOR} on={d.lookingFor} />
          </Field>
          <Field keys={["hobbies"]} label={LABEL.hobbies} group="hobbies" tall>
            <ChipSet k="hobbies" options={HOBBIES} on={d.hobbies} />
          </Field>
        </>
      );
      break;
    case "background":
      fields = (
        <>
          <Field
            keys={["races"]}
            label={LABEL.races}
            sub="All that apply"
            group="races"
            tall
            error={error(["races"])}
          >
            <ChipSet
              k="races"
              options={RACES}
              on={d.races}
              quiet={PREFER_NOT}
              invalid={ed.shown.has("races")}
            />
          </Field>
          {(
            [
              ["gender", GENDERS],
              ["firstGeneration", YES_NO],
              ["lowIncome", YES_NO],
            ] as const
          ).map(([k, options]) => (
            <Field key={k} keys={[k]} label={LABEL[k]} group={k} tall radio error={error([k])}>
              <ChipSet
                k={k}
                options={options}
                on={[d[k]]}
                quiet={PREFER_NOT}
                radio={k}
                invalid={ed.shown.has(k)}
              />
            </Field>
          ))}
        </>
      );
      break;
    case "resume": {
      const resume = res.uploaded ?? me.resume;
      const book = res.book ?? (resume && me.materials?.resumeBook ? "in" : "out");
      fields = (
        <>
          <Field
            keys={["resume"]}
            label="Resume"
            group="resume"
            tall
            error={res.error ?? undefined}
          >
            {resume ? (
              <p className="file">
                <b>{resume.name}</b>
                <span>{size(resume.size)}</span>
                <span className="ok" hidden>
                  <i className="ic tick" />
                  Saved
                </span>
              </p>
            ) : (
              <p className="file none">
                <b>No resume yet</b>
              </p>
            )}
            {res.confirm ? (
              <div className="confirm" role="group" aria-labelledby="rm-q">
                <p id="rm-q">Remove your resume? This also takes you out of the resume book.</p>
                <div className="fa">
                  <button
                    type="button"
                    className="solid"
                    data-act="rm-yes"
                    aria-busy={res.busy === "remove" || undefined}
                  >
                    {res.busy === "remove" && res.slow ? "Removing…" : "Remove"}
                  </button>
                  <button type="button" className="q" data-act="rm-no" disabled={!!res.busy}>
                    Keep it
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="fa">
                  <button
                    type="button"
                    className="solid"
                    id="replace"
                    data-act="upload"
                    aria-busy={res.busy === "upload" || undefined}
                  >
                    {res.busy === "upload" && res.slow
                      ? "Uploading…"
                      : resume
                        ? "Replace PDF"
                        : "Upload a PDF"}
                  </button>
                  {resume ? (
                    <>
                      {resumeUrl ? (
                        <a className="q" href={resumeUrl} target="_blank" rel="noreferrer">
                          View
                        </a>
                      ) : null}
                      <button type="button" className="q" data-act="rm">
                        Remove
                      </button>
                    </>
                  ) : null}
                </div>
                <p className="hint">PDF · {RESUME_LIMIT} max</p>
              </>
            )}
            <input
              type="file"
              id="resume-file"
              accept="application/pdf"
              className="sr-only"
              tabIndex={-1}
              aria-hidden
            />
          </Field>
          <Field
            keys={["book"]}
            label={LABEL.resumeBook}
            group="book"
            tall
            radio
            error={res.bookError ?? undefined}
          >
            <div className="after">
              <ChipSet k="book" options={BOOK} on={[book]} disabled={!resume} radio="book" />
              <span className="bk">
                {res.bookLabel === "saving" ? (
                  <>
                    <i className="spin" aria-hidden />
                    Saving…
                  </>
                ) : res.bookLabel === "saved" ? (
                  <span className="ok" hidden>
                    <i className="ic tick" />
                    Saved
                  </span>
                ) : null}
              </span>
            </div>
            <p className="hint">
              {resume
                ? "The book our partner companies see. You can switch this off any time."
                : "Upload a resume to join the resume book."}
            </p>
          </Field>
        </>
      );
      break;
    }
  }

  const lead = LEAD[ed.editor];
  return (
    <form
      className={ed.saving ? "ed busy" : "ed"}
      id="ed"
      noValidate
      aria-labelledby={`h-${ed.group}`}
    >
      {lead ? <p className="lead">{lead}</p> : null}
      {fields}
      <div className="act">
        {editor.instant ? (
          <div className="fa">
            <button type="button" className="q" data-act="done">
              Done
            </button>
          </div>
        ) : ed.asking ? (
          <div className="ask" role="group" aria-labelledby="ask-q">
            <p id="ask-q">You haven't saved these changes.</p>
            <div className="fa">
              <button type="button" className="q" data-act="discard">
                Discard changes
              </button>
              <button type="button" className="q" data-act="keep">
                Keep editing
              </button>
              <button type="button" className="solid" data-act="save">
                Save changes
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="err" role="alert" hidden={!ed.error}>
              {ed.error ? (
                <>
                  <ErrorBadge />
                  <span>{ed.error}</span>
                </>
              ) : null}
            </p>
            <div className="fa">
              <button type="button" className="q" data-act="cancel" disabled={ed.busy}>
                Cancel
              </button>
              <button type="submit" className="solid" aria-busy={ed.busy || undefined}>
                {ed.saving ? "Saving…" : "Save"}
              </button>
            </div>
          </>
        )}
      </div>
    </form>
  );
}
