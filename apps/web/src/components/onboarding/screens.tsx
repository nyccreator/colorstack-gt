import { api } from "@colorstack-gt/backend/convex/_generated/api";
import {
  RESUME_CONTENT_TYPE,
  RESUME_MAX_BYTES,
  resumeName,
  TEXT_MAX_LENGTH,
} from "@colorstack-gt/backend/convex/lib/config";
import { toggleRace } from "@colorstack-gt/backend/convex/lib/demographics";
import { graduationYearOptions } from "@colorstack-gt/backend/convex/lib/graduation";
import {
  isPhone,
  personalEmailError,
  profileError,
  profileName,
  type ProfileSite,
} from "@colorstack-gt/backend/convex/lib/identity";
import { DEGREE_PROGRAMS, degreeLevel } from "@colorstack-gt/backend/convex/lib/programs";
import { env } from "@colorstack-gt/env/web";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";
import {
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { authClient } from "@/lib/auth-client";
import { still } from "@/lib/motion";

import { field } from "../gate";
import { Message } from "../message";
import { answer, Chips, Prefixed, Ring, Rows } from "./controls";
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
  YES_NO,
} from "./options";

export type Profile = NonNullable<FunctionReturnType<typeof api.members.me>>;

export type Group = "name" | "contact" | "studies" | "materials" | "background" | "interests";

// One question a screen; each group saves with its own mutation when its last question is answered.
export const QUESTIONS = [
  { slug: "name", group: "name", title: "What’s your name?" },
  { slug: "pronouns", group: "name", title: "Your pronouns", pick: true },
  { slug: "contact", group: "contact", title: "Where can we reach you?" },
  { slug: "year", group: "studies", title: "What year are you in?", pick: true },
  { slug: "major", group: "studies", title: "What’s your major?" },
  { slug: "graduation", group: "studies", title: "When do you graduate?" },
  { slug: "gpa", group: "studies", title: "What’s your GPA?", pick: true },
  { slug: "career", group: "materials", title: "Show companies your work", skip: "Skip for now" },
  { slug: "goals", group: "interests", title: "What are you here for?", skip: "Skip" },
  { slug: "hobbies", group: "interests", title: "And outside class?", skip: "Skip" },
  {
    slug: "identity",
    group: "background",
    title: "How do you identify?",
    note: "Choose all that apply. Kept apart from your profile. Every question here has Prefer not to answer.",
  },
  { slug: "gender", group: "background", title: "Your gender", pick: true },
  {
    slug: "first-gen",
    group: "background",
    title: "Are you a first‑generation college student?",
    pick: true,
  },
  {
    slug: "low-income",
    group: "background",
    title: "Do you come from a low‑income background?",
    pick: true,
  },
] as const satisfies readonly {
  slug: string;
  group: Group;
  title: string;
  note?: string;
  pick?: true;
  skip?: string;
}[];

export type Question = (typeof QUESTIONS)[number];
export type Slug = Question["slug"];

export function saved(me: Profile, group: Group) {
  switch (group) {
    case "name":
      return Boolean(me.name);
    case "contact":
      return Boolean(me.contact);
    case "studies":
      return Boolean(me.studies);
    case "materials":
      return Boolean(me.materials || me.resume) || me.step > 3;
    case "background":
      return me.reported;
    case "interests":
      return Boolean(me.interests) || me.step > 4;
  }
}

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

const CHOOSE = "Choose an answer.";

// The same rules the mutations apply, keyed by the id of the control each message belongs to.
export function checksFor(slug: Slug, d: Draft): Record<string, string | undefined> {
  switch (slug) {
    case "name":
      return {
        "first-name": d.firstName.trim() ? undefined : "Enter your first name.",
        "last-name": d.lastName.trim() ? undefined : "Enter your last name.",
      };
    case "pronouns":
      return {
        pronouns: d.choice ? undefined : "Choose your pronouns.",
        "write-in":
          d.choice === SELF_DESCRIBE && !d.writeIn.trim() ? "Enter your pronouns." : undefined,
      };
    case "contact":
      return {
        "personal-email": personalEmailError(d.personalEmail),
        phone: isPhone(d.phone) ? undefined : "Enter a valid phone number.",
      };
    case "year":
      return { standing: d.standing ? undefined : CHOOSE };
    case "major":
      return { major: d.major.trim() ? undefined : "Choose your major." };
    case "graduation":
      return {
        "graduation-season": d.season ? undefined : "Choose a term.",
        "graduation-year": d.year ? undefined : "Choose a year.",
      };
    case "gpa":
      return { gpa: d.gpa ? undefined : CHOOSE };
    case "career":
      return {
        linkedin: profileError("linkedin", d.linkedin),
        github: profileError("github", d.github),
      };
    case "identity":
      return {
        race: d.races.length ? undefined : "Choose at least one answer.",
      };
    case "gender":
      return { gender: d.gender ? undefined : CHOOSE };
    case "first-gen":
      return { "first-generation": d.firstGeneration ? undefined : CHOOSE };
    case "low-income":
      return { "low-income": d.lowIncome ? undefined : CHOOSE };
    case "goals":
    case "hobbies":
      return {};
  }
}

export const passes = (slug: Slug, d: Draft) =>
  Object.values(checksFor(slug, d)).every((message) => !message);

const typedName = (site: ProfileSite, value: string) => {
  const name = profileName(site, value);
  return name === value.trim() ? value.trimStart() : name;
};

export const failureText = (failure: unknown) =>
  failure instanceof ConvexError
    ? String(failure.data)
    : "We couldn't save that. Check your connection and try again.";

export function useSave() {
  const saveName = useMutation(api.members.saveName);
  const saveContact = useMutation(api.members.saveContact);
  const saveStudies = useMutation(api.members.saveStudies);
  const saveMaterials = useMutation(api.members.saveMaterials);
  const saveDemographics = useMutation(api.members.saveDemographics);
  const saveInterests = useMutation(api.members.saveInterests);
  const skip = useMutation(api.members.skip);

  return async (group: Group, d: Draft, me: Profile) => {
    switch (group) {
      case "name":
        await saveName({
          firstName: d.firstName,
          lastName: d.lastName,
          pronouns: d.choice === SELF_DESCRIBE ? d.writeIn.trim() : d.choice,
        });
        return;
      case "contact":
        await saveContact({ personalEmail: d.personalEmail, phone: d.phone });
        return;
      case "studies":
        if (!d.standing || !d.season || !d.gpa) return;
        await saveStudies({
          classStanding: d.standing,
          major: d.major,
          minor: d.minor.trim() || undefined,
          graduationSeason: d.season,
          graduationYear: Number(d.year),
          gpa: d.gpa,
        });
        return;
      case "materials":
        if (!d.linkedin.trim() && !d.github.trim() && !me.resume && !me.materials) {
          await skip({ step: 4 });
        } else {
          await saveMaterials({
            linkedin: d.linkedin.trim() || undefined,
            github: d.github.trim() || undefined,
            resumeBook: d.resumeBook && Boolean(me.resume),
          });
        }
        return;
      case "background":
        if (!d.gender || !d.firstGeneration || !d.lowIncome) return;
        await saveDemographics({
          raceEthnicity: d.races,
          gender: d.gender,
          firstGeneration: d.firstGeneration,
          lowIncome: d.lowIncome,
        });
        return;
      case "interests":
        if (d.lookingFor.length === 0 && d.hobbies.length === 0 && !me.interests) {
          await skip({ step: 5 });
        } else await saveInterests({ lookingFor: d.lookingFor, hobbies: d.hobbies });
    }
  };
}

const scroller = (el: Element) => {
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if ((o === "auto" || o === "scroll") && p.scrollHeight > p.clientHeight) return p;
  }
  return null;
};

const messageFor = (k: string) => {
  const id = document.getElementById(k)?.getAttribute("aria-describedby")?.split(" ")[0];
  return id ? document.getElementById(id) : null;
};

// The visible part of the page: above Continue and its fade where it is pinned to the bottom.
function viewOf(el: Element) {
  const s = scroller(el);
  if (s) return { s, top: s.getBoundingClientRect().top, bottom: s.getBoundingClientRect().bottom };
  const pin = document.querySelector("[data-pin]");
  const bottom =
    pin && getComputedStyle(pin).position === "fixed"
      ? pin.getBoundingClientRect().top -
        (parseFloat(getComputedStyle(pin, "::before").height) || 0)
      : innerHeight;
  return { s, top: 0, bottom };
}

// After Continue the page moves only as far as it takes to show the first problem down to its message, the message first.
function reveal(msg: HTMLElement, block: Element) {
  const { s, top, bottom } = viewOf(msg);
  const hi = block.getBoundingClientRect().top - top - 16;
  const lo = msg.getBoundingClientRect().bottom - bottom + 16;
  const d = lo <= hi ? Math.min(Math.max(0, lo), hi) : lo;
  if (Math.abs(d) < 1) return;
  (s ?? window).scrollBy({ top: d, behavior: still() ? "instant" : "smooth" });
}

// The You page's rule: a problem shows once its field is left or Continue is pressed, and leaves once it's fixed.
// Keys are element ids, so Continue can move focus to the first problem.
export function useChecks(errors: Record<string, string | undefined>) {
  const [shown, setShown] = useState<ReadonlySet<string>>(new Set());
  const held = useRef<{ el: Element | null; y: number; k: string } | null>(null);
  const pressed = useRef({ x: 0, y: 0, at: -Infinity });
  useEffect(() => {
    const down = (e: PointerEvent) =>
      (pressed.current = { x: e.clientX, y: e.clientY, at: e.timeStamp });
    document.addEventListener("pointerdown", down, true);
    return () => document.removeEventListener("pointerdown", down, true);
  }, []);
  // A message opening above where the member went next moves the page instead, short of lifting the message off the top;
  // one opening below the visible part of the page is brought up, as far as keeps where the member went in view.
  useLayoutEffect(() => {
    const h = held.current;
    held.current = null;
    const msg = h && messageFor(h.k);
    if (!h || !msg) return;
    const el = h.el?.isConnected ? h.el : null;
    const { s, top, bottom } = viewOf(msg);
    const scroll = (by: number) => {
      if (by >= 1) (s ?? window).scrollBy({ top: by, behavior: "instant" });
    };
    const d = el ? el.getBoundingClientRect().top - h.y : 0;
    if (d >= 1) return scroll(Math.min(d, Math.max(0, msg.getBoundingClientRect().top - top - 16)));
    const over = msg.getBoundingClientRect().bottom + 16 - bottom;
    if (over >= 1)
      scroll(Math.min(over, el ? Math.max(0, el.getBoundingClientRect().top - top - 16) : over));
  }, [shown]);
  const show = (keys: string[]) => setShown((s) => new Set([...s, ...keys]));
  // A press shows the message only once it has landed, so the message can't move what was pressed out from under it.
  const leave = (k: string) => (e: FocusEvent) => {
    const p = pressed.current;
    const pressing = e.timeStamp - p.at < 1000;
    const el =
      e.relatedTarget instanceof Element
        ? e.relatedTarget
        : pressing
          ? document.elementFromPoint(p.x, p.y)
          : null;
    const open = () => {
      held.current = { el, y: el?.isConnected ? el.getBoundingClientRect().top : 0, k };
      show([k]);
    };
    if (!pressing) return open();
    let done = false;
    const landed = () => {
      if (done) return;
      done = true;
      document.removeEventListener("click", landed, true);
      setTimeout(open);
    };
    document.addEventListener("click", landed, true);
    setTimeout(landed, 600);
  };
  const error = (k: string) => (shown.has(k) ? errors[k] : undefined);
  return {
    error,
    describedBy: (k: string, block = k) => (error(k) ? `${block}-error` : undefined),
    field: (k: string, block = k) => ({
      id: k,
      onBlur: leave(k),
      "aria-invalid": error(k) ? true : undefined,
      "aria-describedby": error(k) ? `${block}-error` : undefined,
    }),
    ready() {
      const bad = Object.keys(errors).filter((k) => errors[k]);
      if (!bad.length) return true;
      show(bad);
      requestAnimationFrame(() => {
        const el = document.getElementById(bad[0]!);
        const block = el?.closest("[data-block]") ?? el;
        const msg = [...(block?.querySelectorAll<HTMLElement>("[role=alert]") ?? [])].at(-1);
        if (block && msg) reveal(msg, block);
        (el?.matches("input, select")
          ? el
          : el?.querySelector<HTMLElement>("[tabindex='0'], button")
        )?.focus({ preventScroll: true });
      });
      return false;
    },
  };
}

export type Checks = ReturnType<typeof useChecks>;

export const RESUME_LIMIT = `${RESUME_MAX_BYTES / 1024 / 1024}MB`;

/** Sends the resume straight to the member's own row and returns an error to show, if any. */
export async function uploadResume(file: File): Promise<string | null> {
  if (file.type !== RESUME_CONTENT_TYPE) return "Upload a PDF.";
  if (file.size > RESUME_MAX_BYTES) return `Keep the file under ${RESUME_LIMIT}.`;
  try {
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
  } catch {
    return "Upload failed. Try again.";
  }
}

const PRONOUN_OPTIONS = PRONOUNS.map((value) => ({ value, label: value }));
const YEAR_OPTIONS = graduationYearOptions().map((year) => ({
  value: String(year),
  label: String(year),
}));
const ALL_PROGRAMS = [...new Set(Object.values(DEGREE_PROGRAMS).flat())];
const PREFER = "prefer_not_to_answer";

function Problem({ id, text }: { id: string; text?: string }) {
  return text ? (
    <Message tone="error" id={id}>
      {text}
    </Message>
  ) : null;
}

const note = "mt-3 text-fine/[1.45] text-pretty text-diploma/70 roomy:text-label/[1.45]";

const textInput = (kind?: "last") => ({
  maxLength: TEXT_MAX_LENGTH,
  enterKeyHint: kind === "last" ? ("done" as const) : ("next" as const),
  className: field,
});

// A field that suggests Georgia Tech programs as you type and still takes a write-in.
function Program({
  id,
  label,
  placeholder,
  value,
  programs,
  onChange,
  bind,
  last,
  extra,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  programs: readonly string[];
  onChange: (value: string) => void;
  bind?: ReturnType<Checks["field"]>;
  last: boolean;
  extra?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const typed = value.trim().toLowerCase();
  const starts = (p: string) => p.toLowerCase().startsWith(typed);
  const matches = typed
    ? programs
        .filter((p) => p.toLowerCase().includes(typed))
        .sort((a, b) => Number(starts(b)) - Number(starts(a)))
        .slice(0, 3)
    : [];
  const shown =
    open && matches.length > 0 && !(matches.length === 1 && matches[0]!.toLowerCase() === typed);
  const list = `${id}-list`;

  function choose(program: string) {
    onChange(program);
    setOpen(false);
    setActive(-1);
  }

  function keys(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((i) => Math.min(matches.length - 1, Math.max(-1, i + step)));
    } else if (event.key === "Enter" && shown && active >= 0) {
      event.preventDefault();
      choose(matches[active]!);
    } else if (event.key === "Escape" && shown) {
      event.preventDefault();
      setOpen(false);
    }
  }

  // The suggestions float over the page, so opening and closing them never moves Continue.
  return (
    <div className="relative">
      <input
        {...bind}
        id={id}
        {...textInput(last ? "last" : undefined)}
        role="combobox"
        autoCorrect="off"
        aria-label={label}
        aria-autocomplete="list"
        aria-expanded={shown}
        aria-controls={shown ? list : undefined}
        aria-activedescendant={shown && active >= 0 ? `${id}-${active}` : undefined}
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onBlur={(event) => {
          setOpen(false);
          const exact = programs.find((p) => p.toLowerCase() === typed);
          if (exact && exact !== value) onChange(exact);
          bind?.onBlur(event);
        }}
        onKeyDown={keys}
        className={`${field} ${extra ? "pr-15 roomy:pr-18" : ""}`}
      />
      {extra}
      {shown ? (
        <ul
          id={list}
          role="listbox"
          aria-label={label}
          className="absolute inset-x-0 top-full z-40 mt-3 rounded-3xl bg-navy p-1 shadow-[0_10px_30px] shadow-navy/35"
        >
          {matches.map((program, i) => {
            const at = program.toLowerCase().indexOf(typed);
            return (
              <li
                key={program}
                id={`${id}-${i}`}
                role="option"
                aria-selected={i === active}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => choose(program)}
                className={`flex min-h-12 cursor-pointer items-center rounded-[20px] px-4 py-2 type-heading text-lg leading-snug text-diploma/86 roomy:px-7 ${
                  i === active ? "bg-diploma/13" : "hover:bg-diploma/8"
                }`}
              >
                <span>
                  {program.slice(0, at)}
                  <b className="font-semibold text-diploma">
                    {program.slice(at, at + typed.length)}
                  </b>
                  {program.slice(at + typed.length)}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function Major({ d, set, check }: BodyProps) {
  const [second, setSecond] = useState(Boolean(d.minor));
  const programs = d.standing ? DEGREE_PROGRAMS[degreeLevel(d.standing)] : ALL_PROGRAMS;
  return (
    <div data-block>
      <Program
        id="major"
        label="Major"
        placeholder="Start typing"
        value={d.major}
        programs={programs}
        onChange={(major) => set({ major })}
        bind={check.field("major")}
        last={!second}
      />
      <Problem id="major-error" text={check.error("major")} />
      {second ? (
        <div className="mt-4">
          <Program
            id="minor"
            label="Second major or minor"
            placeholder="Second major or minor"
            value={d.minor}
            programs={programs}
            onChange={(minor) => set({ minor })}
            last
            extra={
              <button
                type="button"
                aria-label="Remove second major or minor"
                onClick={() => {
                  set({ minor: "" });
                  setSecond(false);
                  requestAnimationFrame(() => document.getElementById("add-second")?.focus());
                }}
                className="absolute top-1/2 right-2 grid size-11 -translate-y-1/2 cursor-pointer place-items-center rounded-full text-diploma/70 transition-[background-color,color] hover:bg-diploma/13 hover:text-diploma focus-visible:outline-offset-0 roomy:right-3 roomy:size-12"
              >
                <svg viewBox="0 0 24 24" fill="none" aria-hidden className="size-5.5">
                  <path
                    d="M7 7l10 10M17 7L7 17"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            }
          />
        </div>
      ) : (
        <button
          id="add-second"
          type="button"
          onClick={() => {
            setSecond(true);
            requestAnimationFrame(() => document.getElementById("minor")?.focus());
          }}
          className="mt-4 inline-flex min-h-12 cursor-pointer items-center rounded-full px-5 text-left type-heading text-base font-semibold text-diploma/86 transition-[background-color,color] hover:bg-diploma/13 hover:text-diploma roomy:px-8 roomy:text-lg"
        >
          + Add a second major or minor
        </button>
      )}
    </div>
  );
}

function Career({ me, d, set, check, setUploading }: BodyProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const was = useRef(me.resume);

  // The new name shows once the member's row has it, so the field never flashes back to the old one.
  useEffect(() => {
    if (!busy || me.resume === was.current) return;
    setBusy(null);
    setUploading(false);
  }, [busy, me.resume, setUploading]);

  // A file dropped beside the field rather than on it would open in the tab and lose the answers.
  useEffect(() => {
    const stop = (event: DragEvent) => event.preventDefault();
    addEventListener("dragover", stop);
    addEventListener("drop", stop);
    return () => {
      removeEventListener("dragover", stop);
      removeEventListener("drop", stop);
    };
  }, []);

  async function attach(file: File | undefined) {
    if (!file || busy) return;
    was.current = me.resume;
    setBusy(file.name);
    setUploading(true);
    setProblem(null);
    const failure = await uploadResume(file);
    // The same file again leaves the member's row as it was, so nothing else would end the upload.
    const same = was.current?.name === resumeName(file.name) && was.current?.size === file.size;
    if (!failure && !same) return;
    setProblem(failure);
    setBusy(null);
    setUploading(false, Boolean(failure));
  }

  const book = Boolean(me.resume) && d.resumeBook;
  const link = (site: ProfileSite, last?: "last") => (
    <Prefixed
      prefix={site === "linkedin" ? "linkedin.com/in/" : "github.com/"}
      {...check.field(site)}
      {...textInput(last)}
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      aria-label={site === "linkedin" ? "LinkedIn username" : "GitHub username"}
      value={d[site]}
      onChange={(event) => set({ [site]: typedName(site, event.target.value) })}
    />
  );

  return (
    <div data-block>
      <div className="grid grid-cols-1 gap-4">
        {link("linkedin")}
        {link("github", "last")}
        <label
          onDragEnter={() => setOver(true)}
          onDragLeave={() => setOver(false)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            setOver(false);
            void attach(event.dataTransfer.files[0]);
          }}
          className={`group flex cursor-pointer items-center gap-3 rounded-full bg-navy/45 type-heading tracking-[-0.01em] has-focus-visible:outline-2 has-focus-visible:outline-offset-4 has-focus-visible:outline-burdell has-aria-invalid:outline-2 has-aria-invalid:outline-offset-4 has-aria-invalid:outline-azalea has-aria-disabled:cursor-wait ${over ? "outline-2 outline-offset-4 outline-burdell" : ""} ${field}`}
        >
          <input
            id="resume"
            type="file"
            accept={RESUME_CONTENT_TYPE}
            aria-disabled={busy ? true : undefined}
            onClick={(event) => {
              if (busy) event.preventDefault();
            }}
            aria-label={
              me.resume
                ? `Resume, ${me.resume.name}. Replace`
                : `Upload a resume, a PDF up to ${RESUME_LIMIT}`
            }
            aria-invalid={problem ? true : undefined}
            aria-describedby={problem ? "resume-error" : undefined}
            className="sr-only"
            onChange={(event) => {
              void attach(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <span
            aria-live="polite"
            className={`min-w-0 flex-1 truncate ${busy ? "text-diploma/70" : me.resume ? "" : "text-diploma/60"}`}
          >
            {busy ?? me.resume?.name ?? (
              <>
                Resume · PDF, {RESUME_LIMIT}
                <span className="max-[359px]:hidden"> max</span>
              </>
            )}
          </span>
          <span
            aria-live="polite"
            className={`flex-none ${busy ? "font-sans text-fine font-normal tracking-normal text-diploma/60" : "text-base font-semibold text-diploma/86 transition-colors group-hover:text-diploma roomy:text-lg"}`}
          >
            {busy ? "Uploading…" : me.resume ? "Replace" : "Upload"}
          </span>
        </label>
        <button
          type="button"
          role="checkbox"
          aria-checked={book}
          aria-describedby="book-note"
          disabled={!me.resume}
          onClick={() => set({ resumeBook: !book })}
          className={`${answer(book)} disabled:cursor-not-allowed disabled:bg-diploma/7 disabled:text-diploma/45 disabled:hover:bg-diploma/7 disabled:hover:text-diploma/45 disabled:[&>span]:ring-diploma/16`}
        >
          <span className="min-w-0 truncate">Add it to the resume book</span>
          <Ring on={book} />
        </button>
      </div>
      <p id="book-note" className={`${note} max-[359px]:min-h-[2lh]`}>
        {me.resume
          ? "Partner companies see it. Switch off any time."
          : "Upload a resume to join the resume book."}
      </p>
      <Problem id="linkedin-error" text={check.error("linkedin")} />
      <Problem id="github-error" text={check.error("github")} />
      <Problem id="resume-error" text={problem ?? undefined} />
    </div>
  );
}

export type BodyProps = {
  me: Profile;
  d: Draft;
  set: (patch: Partial<Draft>) => void;
  check: Checks;
  titleId: string;
  setUploading: (on: boolean, failed?: boolean) => void;
  onPick: (settled: boolean, patch?: Partial<Draft>) => void;
};

export function Body({ slug, ...props }: BodyProps & { slug: Slug }) {
  const { d, set, check, titleId, onPick } = props;
  const rows = <T extends string>(
    id: string,
    options: readonly { value: T; label: string }[],
    value: T | "",
    patch: (value: T) => Partial<Draft>,
    quiet?: T,
    wide?: boolean,
  ) => (
    <div data-block>
      <Rows
        id={id}
        labelledBy={titleId}
        describedBy={check.describedBy(id)}
        options={options}
        value={value}
        quiet={quiet}
        wide={wide}
        onPick={(v, settled) => {
          set(patch(v));
          onPick(settled, patch(v));
        }}
      />
      <Problem id={`${id}-error`} text={check.error(id)} />
    </div>
  );

  switch (slug) {
    case "name":
      return (
        <div data-block>
          <div className="grid gap-4 roomy:grid-cols-2">
            <input
              {...check.field("first-name")}
              {...textInput()}
              aria-label="First name"
              autoComplete="given-name"
              placeholder="First name"
              value={d.firstName}
              onChange={(event) => set({ firstName: event.target.value })}
            />
            <input
              {...check.field("last-name", "first-name")}
              {...textInput("last")}
              aria-label="Last name"
              autoComplete="family-name"
              placeholder="Last name"
              value={d.lastName}
              onChange={(event) => set({ lastName: event.target.value })}
            />
          </div>
          <Problem
            id="first-name-error"
            text={
              check.error("first-name") && check.error("last-name")
                ? "Enter your first and last name."
                : (check.error("first-name") ?? check.error("last-name"))
            }
          />
        </div>
      );
    case "pronouns":
      return (
        <>
          <div data-block>
            <Rows
              id="pronouns"
              labelledBy={titleId}
              describedBy={check.describedBy("pronouns")}
              options={PRONOUN_OPTIONS}
              value={d.choice}
              quiet={SELF_DESCRIBE}
              onPick={(v, settled) => {
                set({ choice: v });
                if (v !== SELF_DESCRIBE) return onPick(settled, { choice: v });
                onPick(false);
                if (settled)
                  requestAnimationFrame(() => document.getElementById("write-in")?.focus());
              }}
            />
            <Problem id="pronouns-error" text={check.error("pronouns")} />
          </div>
          {d.choice === SELF_DESCRIBE ? (
            <div data-block className="mt-4">
              <input
                {...check.field("write-in")}
                {...textInput("last")}
                autoCapitalize="none"
                aria-label="Your pronouns"
                placeholder="Your pronouns"
                value={d.writeIn}
                onChange={(event) => set({ writeIn: event.target.value })}
              />
              <Problem id="write-in-error" text={check.error("write-in")} />
            </div>
          ) : null}
        </>
      );
    case "contact":
      return (
        <div data-block>
          <div className="grid grid-cols-1 gap-4">
            <input
              {...check.field("personal-email")}
              {...textInput()}
              type="email"
              inputMode="email"
              autoComplete="email"
              aria-label="Personal email"
              placeholder="Personal email"
              value={d.personalEmail}
              onChange={(event) => set({ personalEmail: event.target.value })}
            />
            <input
              {...check.field("phone")}
              {...textInput("last")}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              aria-label="Phone"
              placeholder="Phone"
              value={d.phone}
              onChange={(event) => set({ phone: event.target.value })}
            />
          </div>
          <Problem id="personal-email-error" text={check.error("personal-email")} />
          <Problem id="phone-error" text={check.error("phone")} />
        </div>
      );
    case "year":
      return rows(
        "standing",
        CLASS_STANDINGS,
        d.standing,
        (standing) =>
          d.standing && degreeLevel(standing) !== degreeLevel(d.standing)
            ? { standing, major: "", minor: "" }
            : { standing },
        undefined,
        true,
      );
    case "major":
      return <Major {...props} />;
    case "graduation":
      return (
        <>
          <div data-block>
            <p id="term-label" className="mb-2.5 type-label text-diploma/70">
              Term
            </p>
            <Chips
              id="graduation-season"
              labelledBy={`${titleId} term-label`}
              describedBy={check.describedBy("graduation-season")}
              options={SEASONS}
              selected={d.season ? [d.season] : []}
              onToggle={(season) => set({ season })}
              single
            />
            <Problem id="graduation-season-error" text={check.error("graduation-season")} />
          </div>
          <div data-block className="mt-6">
            <p id="year-label" className="mb-2.5 type-label text-diploma/70">
              Year
            </p>
            <Chips
              id="graduation-year"
              labelledBy={`${titleId} year-label`}
              describedBy={check.describedBy("graduation-year")}
              options={YEAR_OPTIONS}
              selected={d.year ? [d.year] : []}
              onToggle={(year) => set({ year })}
              single
            />
            <Problem id="graduation-year-error" text={check.error("graduation-year")} />
          </div>
        </>
      );
    case "gpa":
      return rows("gpa", GPA_RANGES, d.gpa, (gpa) => ({ gpa }), "not_applicable", true);
    case "career":
      return <Career {...props} />;
    case "identity":
      return (
        <>
          <div data-block>
            <Chips
              id="race"
              labelledBy={titleId}
              describedBy={check.describedBy("race")}
              note="question-note"
              options={RACES}
              selected={d.races}
              onToggle={(value) => set({ races: toggleRace(d.races, value) })}
              quiet={PREFER}
            />
            <Problem id="race-error" text={check.error("race")} />
          </div>
        </>
      );
    case "gender":
      return rows("gender", GENDERS, d.gender, (gender) => ({ gender }), PREFER);
    case "first-gen":
      return rows(
        "first-generation",
        YES_NO,
        d.firstGeneration,
        (firstGeneration) => ({ firstGeneration }),
        PREFER,
      );
    case "low-income":
      return rows("low-income", YES_NO, d.lowIncome, (lowIncome) => ({ lowIncome }), PREFER);
    case "goals":
      return (
        <Chips
          id="looking-for"
          labelledBy={titleId}
          options={LOOKING_FOR}
          selected={d.lookingFor}
          onToggle={(value) =>
            set({
              lookingFor: d.lookingFor.includes(value)
                ? d.lookingFor.filter((v) => v !== value)
                : [...d.lookingFor, value],
            })
          }
        />
      );
    case "hobbies":
      return (
        <Chips
          id="hobbies"
          labelledBy={titleId}
          options={HOBBIES}
          selected={d.hobbies}
          onToggle={(value) =>
            set({
              hobbies: d.hobbies.includes(value)
                ? d.hobbies.filter((v) => v !== value)
                : [...d.hobbies, value],
            })
          }
        />
      );
  }
}
