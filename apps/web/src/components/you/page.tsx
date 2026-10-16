import { api } from "@colorstack-gt/backend/convex/_generated/api";
import { TEXT_MAX_LENGTH } from "@colorstack-gt/backend/convex/lib/config";
import { toggleRace } from "@colorstack-gt/backend/convex/lib/demographics";
import {
  graduationYearOptions,
  isGraduationYearAllowed,
} from "@colorstack-gt/backend/convex/lib/graduation";
import {
  isPhone,
  personalEmailError,
  profileError,
  profileName,
  type ProfileSite,
} from "@colorstack-gt/backend/convex/lib/identity";
import { DEGREE_PROGRAMS, degreeLevel } from "@colorstack-gt/backend/convex/lib/programs";
import { useBlocker } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import { flushSync } from "react-dom";

import { Bar, mayLeave, Pages, unsavedWork } from "../frame";
import { ErrorBadge } from "../message";
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
  type Studies,
  TASKS,
  YES_NO,
} from "../onboarding/options";
import { Prefixed } from "../onboarding/controls";
import { type Profile, RESUME_LIMIT, uploadResume } from "../onboarding/screens";
import { MemberCard } from "./card";
import {
  createEditing,
  type Draft,
  type Ed,
  type EditorDef,
  type Editing,
  type Eid,
  type Gid,
  type Res,
  type Row,
  type Value,
} from "./editing";

type Option = { readonly value: string; readonly label: string };
type Group = { id: Gid; title: string; note?: string; rows: (m: Profile) => Row[] };
type Latest = { me: Profile; answers: Answers | null };

const PRIVACY =
  "Only used in the totals we report. Never on your profile or shared with companies.";
const PNTA = "prefer_not_to_answer";
const PRONOUN_OPTIONS = PRONOUNS.map((value) => ({ value, label: value }));
const BOOK = [
  { value: "in", label: "Included" },
  { value: "out", label: "Not included" },
] as const;
const EXTRAS = TASKS.filter((task) => task.value !== "engage");
// What each link shows as a tile on one-column screens: the destination's own logo, unaltered, and one word.
const SHORT = {
  national: { label: "National", logo: "/assets/logos/colorstack-national.png" },
  whatsapp: { label: "WhatsApp", logo: "/assets/logos/whatsapp.svg" },
  instagram: { label: "Instagram", logo: "/assets/logos/instagram.png" },
} as const;
const LEAD: Partial<Record<Eid, string>> = {
  background: PRIVACY,
  res: "Changes here apply right away.",
};

const str = (v: Value | undefined) => (typeof v === "string" ? v : "");
const list = (v: Value | undefined) => (Array.isArray(v) ? v : []);
const label = (options: readonly Option[], v: string | undefined) =>
  options.find((option) => option.value === v)?.label ?? v ?? "";
const labels = (options: readonly Option[], vs: readonly string[] = []) => {
  const all = options.filter((option) => vs.includes(option.value)).map((option) => option.label);
  return all.length > 3 ? `${all.slice(0, 2).join(", ")} + ${all.length - 2} more` : all.join(", ");
};
// A long address or link breaks after "@", "." or "/" before it breaks anywhere else, though a short last part such as
// "com" stays with the one before it rather than standing alone on a line.
export const breaks = (text: string) => {
  const parts = text.split(/(?<=[@./])/);
  if (parts.length > 1 && parts.at(-1)!.length < 6) parts.splice(-2, 2, parts.slice(-2).join(""));
  return parts.flatMap((part, i) => (i ? [<wbr key={i} />, part] : [part]));
};
const size = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const toggled = (values: string[], v: string) =>
  values.includes(v) ? values.filter((x) => x !== v) : [...values, v];

const GROUPS: Group[] = [
  {
    id: "who",
    title: "Who you are",
    rows: (m) => [
      { key: "name", label: "Name", value: m.name ? `${m.name.firstName} ${m.name.lastName}` : "" },
      { key: "pronouns", label: "Pronouns", value: m.name?.pronouns ?? "" },
    ],
  },
  {
    id: "contact",
    title: "How we reach you",
    rows: (m) => [
      { key: "gt", label: "Georgia Tech email", value: m.gtEmail, fixed: true },
      { key: "email", label: "Personal email", value: m.contact?.personalEmail ?? "" },
      { key: "phone", label: "Phone", value: m.contact?.phone ?? "" },
    ],
  },
  {
    id: "studies",
    title: "Your studies",
    rows: ({ studies: s }) => [
      { key: "standing", label: "Class standing", value: label(CLASS_STANDINGS, s?.classStanding) },
      { key: "major", label: "Major", value: s?.major ?? "" },
      { key: "minor", label: "Second major or minor", value: s?.minor ?? "" },
      {
        key: "grad",
        label: "Expected graduation",
        value: s ? `${label(SEASONS, s.graduationSeason)} ${s.graduationYear}` : "",
      },
      { key: "gpa", label: "GPA range", value: label(GPA_RANGES, s?.gpa) },
    ],
  },
  {
    id: "career",
    title: "Your career",
    rows: (m) => [
      { key: "resume", label: "Resume", value: m.resume?.name ?? "" },
      {
        key: "book",
        label: "Resume book",
        value: m.resume && m.materials?.resumeBook ? "Included" : "Not included",
      },
      {
        key: "linkedin",
        label: "LinkedIn",
        value: profileName("linkedin", m.materials?.linkedin ?? ""),
      },
      { key: "github", label: "GitHub", value: profileName("github", m.materials?.github ?? "") },
    ],
  },
  {
    id: "interests",
    title: "Your interests",
    rows: (m) => [
      {
        key: "looking",
        label: "What you're looking for",
        value: labels(LOOKING_FOR, m.interests?.lookingFor),
      },
      {
        key: "hobbies",
        label: "Hobbies and interests",
        value: labels(HOBBIES, m.interests?.hobbies),
      },
    ],
  },
  {
    id: "background",
    title: "Your background",
    note: PRIVACY,
    rows: (m) => [
      { key: "answers", label: "Your answers", value: m.reported ? "Saved privately" : "" },
    ],
  },
];
const GROUP = Object.fromEntries(GROUPS.map((g) => [g.id, g])) as Record<Gid, Group>;

function editorsFor(get: () => Latest): Record<Eid, EditorDef> {
  return {
    who: {
      focus: { name: "#first", pronouns: "#choice" },
      draft: () => {
        const name = get().me.name;
        const saved = name?.pronouns ?? "";
        const listed = PRONOUNS.some((option) => option === saved && option !== SELF_DESCRIBE);
        return {
          first: name?.firstName ?? "",
          last: name?.lastName ?? "",
          choice: listed || !saved ? saved || PRONOUNS[0] : SELF_DESCRIBE,
          writeIn: listed ? "" : saved,
        };
      },
      change: (k, d) => {
        if (k === "choice") return d.choice === SELF_DESCRIBE ? "#writeIn" : "#choice";
      },
      check: (d) => {
        const errors: Record<string, string> = {};
        if (!str(d.first).trim()) errors.first = "Enter your first name.";
        if (!str(d.last).trim()) errors.last = "Enter your last name.";
        if (d.choice === SELF_DESCRIBE && !str(d.writeIn).trim()) {
          errors.writeIn = "Enter your pronouns.";
        }
        return errors;
      },
    },
    contact: {
      focus: { email: "#email", phone: "#phone" },
      draft: () => ({
        email: get().me.contact?.personalEmail ?? "",
        phone: get().me.contact?.phone ?? "",
      }),
      check: (d) => {
        const errors: Record<string, string> = {};
        const email = str(d.email);
        const problem = personalEmailError(email);
        if (problem) errors.email = problem;
        if (!isPhone(str(d.phone))) errors.phone = "Enter a valid phone number.";
        return errors;
      },
    },
    studies: {
      focus: {
        standing: "#standing",
        major: "#major",
        minor: "#minor",
        grad: "#season",
        gpa: "#gpa",
      },
      draft: () => {
        const s = get().me.studies;
        return {
          standing: s?.classStanding ?? CLASS_STANDINGS[0].value,
          major: s?.major ?? "",
          minor: s?.minor ?? "",
          season: s?.graduationSeason ?? SEASONS[0].value,
          year: String(s?.graduationYear ?? new Date().getFullYear()),
          gpa: s?.gpa ?? GPA_RANGES[0].value,
        };
      },
      change: (k, d, prev) => {
        if (k !== "standing" || degreeLevel(str(prev)) === degreeLevel(str(d.standing))) return;
        d.major = "";
        const major = document.getElementById("major") as HTMLInputElement | null;
        if (major) major.value = "";
      },
      check: (d) => {
        const errors: Record<string, string> = {};
        if (!str(d.major).trim()) errors.major = "Choose your major.";
        if (!isGraduationYearAllowed(Number(d.year))) {
          errors.year = "Choose a graduation year within four years of today.";
        }
        return errors;
      },
    },
    lnk: {
      focus: { linkedin: "#linkedin", github: "#github" },
      draft: () => ({
        linkedin: profileName("linkedin", get().me.materials?.linkedin ?? ""),
        github: profileName("github", get().me.materials?.github ?? ""),
      }),
      check: (d) => {
        const errors: Record<string, string> = {};
        for (const site of ["linkedin", "github"] as const) {
          const message = profileError(site, str(d[site]));
          if (message) errors[site] = message;
        }
        return errors;
      },
    },
    interests: {
      chips: true,
      focus: { looking: '[data-chips="looking"] .chip', hobbies: '[data-chips="hobbies"] .chip' },
      draft: () => ({
        looking: [...(get().me.interests?.lookingFor ?? [])],
        hobbies: [...(get().me.interests?.hobbies ?? [])],
      }),
      toggle: (k, v, d) => {
        d[k] = toggled(list(d[k]), v);
      },
      check: () => ({}),
    },
    background: {
      chips: true,
      focus: { answers: "#h-background" },
      draft: () => {
        const a = get().answers;
        return {
          race: [...(a?.raceEthnicity ?? [])],
          gender: a?.gender ?? "",
          firstGen: a?.firstGeneration ?? "",
          lowIncome: a?.lowIncome ?? "",
        };
      },
      toggle: (k, v, d) => {
        d[k] = k === "race" ? toggleRace(list(d.race), v) : v;
      },
      check: (d) => {
        const errors: Record<string, string> = {};
        if (!list(d.race).length) {
          errors.race = "Choose at least one answer for race and ethnicity.";
        }
        for (const k of ["gender", "firstGen", "lowIncome"]) {
          if (!str(d[k])) errors[k] = "Choose an answer.";
        }
        return errors;
      },
    },
    res: {
      instant: true,
      focus: { resume: "#replace", book: '[data-chips="book"] .chip[aria-checked="true"]' },
      draft: () => ({}),
      check: () => ({}),
    },
  };
}

export function YouPage({ me, answers }: { me: Profile; answers: Answers | null }) {
  const resumeUrl = useQuery(api.members.resumeUrl, me.resume ? {} : "skip");
  const saveName = useMutation(api.members.saveName);
  const saveContact = useMutation(api.members.saveContact);
  const saveStudies = useMutation(api.members.saveStudies);
  const saveMaterials = useMutation(api.members.saveMaterials);
  const saveInterests = useMutation(api.members.saveInterests);
  const saveDemographics = useMutation(api.members.saveDemographics);
  const removeResume = useMutation(api.members.removeResume);
  const completeTask = useMutation(api.members.completeTask);
  const [, render] = useReducer((n: number) => n + 1, 0);
  const root = useRef<HTMLDivElement>(null);
  const editing = useRef<Editing | null>(null);
  const latest = useRef<Latest>({ me, answers });
  latest.current = { me, answers };
  const editors = useMemo(() => editorsFor(() => latest.current), []);

  // Leaving with unsaved changes, by any way, asks in the browser's own dialog.
  const blocks = useCallback(() => !mayLeave(), []);
  const unsaved = useCallback(() => editing.current?.unsaved() ?? false, []);
  useBlocker({ shouldBlockFn: blocks, enableBeforeUnload: unsaved });

  useEffect(() => {
    const get = () => latest.current;
    const save = (eid: Eid, d: Draft) => {
      const m = get().me;
      switch (eid) {
        case "who":
          return saveName({
            firstName: str(d.first),
            lastName: str(d.last),
            pronouns: d.choice === SELF_DESCRIBE ? str(d.writeIn).trim() : str(d.choice),
          });
        case "contact":
          return saveContact({ personalEmail: str(d.email), phone: str(d.phone) });
        case "studies":
          return saveStudies({
            classStanding: d.standing as Studies["classStanding"],
            major: str(d.major),
            minor: str(d.minor).trim() || undefined,
            graduationSeason: d.season as Studies["graduationSeason"],
            graduationYear: Number(d.year),
            gpa: d.gpa as Studies["gpa"],
          });
        case "lnk":
          return saveMaterials({
            linkedin: str(d.linkedin).trim() || undefined,
            github: str(d.github).trim() || undefined,
            resumeBook: Boolean(m.resume && m.materials?.resumeBook),
          });
        case "interests":
          return saveInterests({
            lookingFor: list(d.looking) as Interests["lookingFor"],
            hobbies: list(d.hobbies) as Interests["hobbies"],
          });
        case "background":
          return saveDemographics({
            raceEthnicity: list(d.race) as Answers["raceEthnicity"],
            gender: d.gender as Answers["gender"],
            firstGeneration: d.firstGen as Answers["firstGeneration"],
            lowIncome: d.lowIncome as Answers["lowIncome"],
          });
        case "res":
          return Promise.resolve();
      }
    };
    const controller = createEditing(root.current!, {
      commit: () => flushSync(() => render()),
      title: (gid) => GROUP[gid].title,
      rows: (gid) => GROUP[gid].rows(get().me),
      editors,
      save,
      setBook: (on) =>
        saveMaterials({
          linkedin: get().me.materials?.linkedin,
          github: get().me.materials?.github,
          resumeBook: on,
        }),
      upload: uploadResume,
      removeResume: () => removeResume(),
      hasResume: () => Boolean(get().me.resume),
      inBook: () => Boolean(get().me.resume && get().me.materials?.resumeBook),
    });
    editing.current = controller;
    controller.start();
    unsavedWork.check = controller.unsaved;
    window.scrollTo(0, 0);
    return () => {
      unsavedWork.check = () => false;
      controller.stop();
      editing.current = null;
    };
  }, []);

  const state = editing.current?.state();
  // the pill keeps its last label while it leaves
  const lastOpen = useRef<Gid>("who");
  if (state?.ed) lastOpen.current = state.ed.gid;
  const since = me.joinedAt
    ? new Date(me.joinedAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "";

  return (
    <div ref={root} className="you">
      <Bar signOut nav={<Pages />} className="bar" />
      <main>
        <h1 className="sr-only">You</h1>
        <div className="lb">
          <div className="side">
            <MemberCard
              seed={me.gtEmail}
              name={`${me.name?.firstName ?? ""} ${me.name?.lastName ?? ""}`.trim()}
              since={since}
            />
            <div className="stay">
              <h2 className="kick" id="stay-h">
                Stay connected
              </h2>
              <ul className="links" aria-labelledby="stay-h">
                {EXTRAS.map((task) => (
                  <li key={task.value}>
                    <a
                      className="lnk"
                      href={task.href}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => void completeTask({ task: task.value })}
                      onAuxClick={(e) => e.button === 1 && void completeTask({ task: task.value })}
                    >
                      <img className="st" src={SHORT[task.value].logo} alt="" />
                      <span className="txt">
                        <b>{task.title}</b>
                        <span>{task.detail}</span>
                      </span>
                      <span className="short" aria-hidden>
                        {SHORT[task.value].label}
                      </span>
                      <i className="ic out" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="groups">
            {GROUPS.map((group) => (
              <GroupView
                key={group.id}
                group={group}
                me={me}
                ed={state?.ed ?? null}
                res={state?.res}
                editors={editors}
                resumeUrl={resumeUrl ?? undefined}
              />
            ))}
          </div>
        </div>
        <button type="button" className="back">
          <span>Back to {GROUP[lastOpen.current].title.toLowerCase()}</span>
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
      <span className="ok" hidden>
        <i className="ic tick" />
        Saved
      </span>
      <i className="ic chev" />
    </button>
  );
}

function GroupView({
  group,
  me,
  ed,
  res,
  editors,
  resumeUrl,
}: {
  group: Group;
  me: Profile;
  ed: Ed | null;
  res?: Res;
  editors: Record<Eid, EditorDef>;
  resumeUrl?: string | null;
}) {
  const open = ed?.gid === group.id ? ed : null;
  const rows = group.rows(me).map((row) => <RowView key={row.key} row={row} />);
  const form =
    open && res ? (
      <Editor ed={open} me={me} res={res} editor={editors[open.eid]} resumeUrl={resumeUrl} />
    ) : null;

  return (
    <section
      className={open ? "grp open" : "grp"}
      id={`g-${group.id}`}
      aria-labelledby={`h-${group.id}`}
    >
      <div className="gh">
        <h2 id={`h-${group.id}`} tabIndex={-1}>
          {group.title}
        </h2>
      </div>
      <div className="gp">
        {group.id === "career" ? (
          <>
            <div className={open?.eid === "lnk" ? "sub off" : "sub"} data-sub="res">
              {open?.eid === "res" ? form : rows.slice(0, 2)}
            </div>
            <div className={open?.eid === "res" ? "sub off" : "sub"} data-sub="lnk">
              {open?.eid === "lnk" ? form : rows.slice(2)}
            </div>
          </>
        ) : (
          (form ?? rows)
        )}
      </div>
      {group.note ? <p className="pv">{group.note}</p> : null}
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
  keys: string;
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
  const errorId = `${keys.split(" ")[0]}-error`;
  const text = sub ? (
    <>
      {label} <span className="ks">{sub}</span>
    </>
  ) : (
    label
  );
  return (
    <div className={tall ? "f tall" : "f"} data-keys={keys}>
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

// One answer is a radio group (one tab stop, arrow keys move the choice); several are toggle buttons.
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
  options: readonly Option[];
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
  const errors = editor.check(d);
  const error = (keys: string) => {
    const k = keys.split(" ").find((x) => ed.shown.has(x));
    return k ? errors[k] : undefined;
  };
  const control = (k: string, block = k) => ({
    id: k,
    "data-k": k,
    "aria-invalid": ed.shown.has(k) || undefined,
    "aria-describedby": ed.shown.has(k) ? `${block}-error` : undefined,
  });
  const text = (k: string, block = k, last = true) => ({
    ...control(k, block),
    defaultValue: str(d[k]),
    maxLength: TEXT_MAX_LENGTH,
    enterKeyHint: last ? ("done" as const) : ("next" as const),
    readOnly: ed.busy,
  });
  // A pasted link keeps only the name after the prefix the field already shows.
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
  const select = (k: string, options: readonly Option[], block = k) => (
    <select {...control(k, block)} defaultValue={str(d[k])}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );

  let fields: ReactNode = null;
  switch (ed.eid) {
    case "who":
      fields = (
        <>
          <Field keys="first last" label="Name" id="first" error={error("first last")}>
            <div className="pair">
              <input
                {...text("first", "first", false)}
                autoComplete="given-name"
                placeholder="First"
                aria-label="First name"
              />
              <input
                {...text("last", "first")}
                autoComplete="family-name"
                placeholder="Last"
                aria-label="Last name"
              />
            </div>
          </Field>
          <Field keys="choice writeIn" label="Pronouns" id="choice" error={error("choice writeIn")}>
            <div className={d.choice === SELF_DESCRIBE ? "pair" : undefined}>
              {select("choice", PRONOUN_OPTIONS)}
              {d.choice === SELF_DESCRIBE ? (
                <input
                  {...text("writeIn", "choice")}
                  aria-label="Your pronouns"
                  placeholder="Your pronouns"
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
            row={{ key: "gt", label: "Georgia Tech email", value: me.gtEmail, fixed: true }}
          />
          <Field keys="email" label="Personal email" id="email" error={error("email")}>
            <input
              {...text("email", "email", false)}
              type="email"
              inputMode="email"
              autoComplete="email"
            />
          </Field>
          <Field keys="phone" label="Phone" id="phone" error={error("phone")}>
            <input {...text("phone")} type="tel" inputMode="tel" autoComplete="tel" />
          </Field>
        </>
      );
      break;
    case "studies": {
      const years = graduationYearOptions().map(String);
      if (!years.includes(str(d.year))) years.push(str(d.year));
      fields = (
        <>
          <Field keys="standing" label="Class standing" id="standing">
            {select("standing", CLASS_STANDINGS)}
          </Field>
          <Field keys="major" label="Major" id="major" error={error("major")}>
            <input
              {...text("major", "major", false)}
              list="majors"
              autoComplete="off"
              placeholder="Start typing"
            />
            <datalist id="majors">
              {DEGREE_PROGRAMS[degreeLevel(str(d.standing))].map((program) => (
                <option key={program} value={program} />
              ))}
            </datalist>
          </Field>
          <Field keys="minor" label="Second major or minor" id="minor">
            <input {...text("minor")} placeholder="Add one" />
          </Field>
          <Field
            keys="season year"
            label="Expected graduation"
            group="grad"
            error={error("season year")}
          >
            <div className="pair">
              <select
                {...control("season")}
                aria-label="Graduation season"
                defaultValue={str(d.season)}
              >
                {SEASONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                {...control("year", "season")}
                aria-label="Graduation year"
                defaultValue={str(d.year)}
              >
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </Field>
          <Field keys="gpa" label="GPA range" id="gpa">
            {select("gpa", GPA_RANGES)}
          </Field>
        </>
      );
      break;
    }
    case "lnk":
      fields = (
        <>
          <Field keys="linkedin" label="LinkedIn" id="linkedin" error={error("linkedin")}>
            <Prefixed prefix="linkedin.com/in/" {...link("linkedin", false)} />
          </Field>
          <Field keys="github" label="GitHub" id="github" error={error("github")}>
            <Prefixed prefix="github.com/" {...link("github")} />
          </Field>
        </>
      );
      break;
    case "interests":
      fields = (
        <>
          <Field keys="looking" label="What you're looking for" group="looking" tall>
            <ChipSet k="looking" options={LOOKING_FOR} on={list(d.looking)} />
          </Field>
          <Field keys="hobbies" label="Hobbies and interests" group="hobbies" tall>
            <ChipSet k="hobbies" options={HOBBIES} on={list(d.hobbies)} />
          </Field>
        </>
      );
      break;
    case "background":
      fields = (
        <>
          <Field
            keys="race"
            label="Race and ethnicity"
            sub="All that apply"
            group="race"
            tall
            error={error("race")}
          >
            <ChipSet
              k="race"
              options={RACES}
              on={list(d.race)}
              quiet={PNTA}
              invalid={ed.shown.has("race")}
            />
          </Field>
          {(
            [
              ["gender", "Gender", "gender", GENDERS],
              ["firstGen", "First-generation college student", "first-gen", YES_NO],
              ["lowIncome", "Low-income background", "low-income", YES_NO],
            ] as const
          ).map(([k, title, group, options]) => (
            <Field key={k} keys={k} label={title} group={group} tall radio error={error(k)}>
              <ChipSet
                k={k}
                options={options}
                on={[str(d[k])]}
                quiet={PNTA}
                radio={group}
                invalid={ed.shown.has(k)}
              />
            </Field>
          ))}
        </>
      );
      break;
    case "res": {
      const resume = me.resume;
      const book = res.book ?? (resume && me.materials?.resumeBook ? "in" : "out");
      fields = (
        <>
          <Field keys="resume" label="Resume" group="resume" tall error={res.error ?? undefined}>
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
                    {res.busy === "remove" ? "Removing…" : "Remove"}
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
                    {res.busy === "upload" ? "Uploading…" : resume ? "Replace PDF" : "Upload a PDF"}
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
            keys="book"
            label="Resume book"
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

  const lead = LEAD[ed.eid];
  return (
    <form className={ed.busy ? "ed busy" : "ed"} id="ed" noValidate aria-labelledby={`h-${ed.gid}`}>
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
