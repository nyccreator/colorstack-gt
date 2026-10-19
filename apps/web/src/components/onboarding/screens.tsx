import { RESUME_CONTENT_TYPE, TEXT_MAX_LENGTH } from "@colorstack-gt/backend/convex/lib/config";
import { PREFER_NOT, toggleRace } from "@colorstack-gt/backend/convex/lib/demographics";
import type { Group } from "@colorstack-gt/backend/convex/lib/groups";
import type { ProfileSite } from "@colorstack-gt/backend/convex/lib/identity";
import { RESUME_LIMIT } from "@colorstack-gt/backend/convex/lib/messages";
import { DEGREE_PROGRAMS, degreeLevel } from "@colorstack-gt/backend/convex/lib/programs";
import {
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import type { Profile } from "@/lib/member";
import { still, useSlowHold } from "@/lib/motion";

import { field } from "../gate";
import { type Draft, type Field, setStanding, typedName, uploadResume } from "../member/draft";
import { Message } from "../message";
import { answer, Chips, Prefixed, Ring, Rows } from "./controls";
import {
  CLASS_STANDINGS,
  GENDERS,
  GPA_RANGES,
  HOBBIES,
  LOOKING_FOR,
  PRONOUN_OPTIONS,
  RACES,
  SEASONS,
  SELF_DESCRIBE,
  YEAR_OPTIONS,
  YES_NO,
} from "./options";

export const QUESTIONS = [
  { slug: "name", group: "name", fields: ["firstName", "lastName"], title: "What’s your name?" },
  {
    slug: "pronouns",
    group: "name",
    fields: ["choice", "writeIn"],
    title: "Your pronouns",
    pick: true,
  },
  {
    slug: "contact",
    group: "contact",
    fields: ["personalEmail", "phone"],
    title: "Where can we reach you?",
  },
  {
    slug: "year",
    group: "studies",
    fields: ["standing"],
    title: "What year are you in?",
    pick: true,
  },
  { slug: "major", group: "studies", fields: ["major"], title: "What’s your major?" },
  {
    slug: "graduation",
    group: "studies",
    fields: ["season", "year"],
    title: "When do you graduate?",
  },
  { slug: "gpa", group: "studies", fields: ["gpa"], title: "What’s your GPA?", pick: true },
  {
    slug: "career",
    group: "materials",
    fields: ["linkedin", "github"],
    title: "Show companies your work",
    skip: "Skip for now",
  },
  { slug: "goals", group: "interests", fields: [], title: "What are you here for?", skip: "Skip" },
  { slug: "hobbies", group: "interests", fields: [], title: "And outside class?", skip: "Skip" },
  {
    slug: "identity",
    group: "background",
    fields: ["races"],
    title: "How do you identify?",
    note: "Choose all that apply. Kept apart from your profile. Every question here has Prefer not to answer.",
  },
  { slug: "gender", group: "background", fields: ["gender"], title: "Your gender", pick: true },
  {
    slug: "first-gen",
    group: "background",
    fields: ["firstGeneration"],
    title: "Are you a first-generation college student?",
    pick: true,
  },
  {
    slug: "low-income",
    group: "background",
    fields: ["lowIncome"],
    title: "Do you come from a low-income background?",
    pick: true,
  },
] as const satisfies readonly {
  slug: string;
  group: Group;
  fields: readonly Field[];
  title: string;
  note?: string;
  pick?: true;
  skip?: string;
}[];

export type Question = (typeof QUESTIONS)[number];
export type Slug = Question["slug"];

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

function reveal(msg: HTMLElement, block: Element) {
  const { s, top, bottom } = viewOf(msg);
  const room = block.getBoundingClientRect().top - top - 16;
  const need = msg.getBoundingClientRect().bottom - bottom + 16;
  const by = need <= room ? Math.min(Math.max(0, need), room) : need;
  if (Math.abs(by) < 1) return;
  (s ?? window).scrollBy({ top: by, behavior: still() ? "instant" : "smooth" });
}

const MESSAGE_GAP = 16;
const PRESS_WINDOW_MS = 1000;
const CLICK_WAIT_MS = 600;

function keepUnderPointer(held: { el: Element | null; y: number }, message: HTMLElement) {
  const under = held.el?.isConnected ? held.el : null;
  const { s: container, top, bottom } = viewOf(message);
  const scroll = (by: number) => {
    if (by >= 1) (container ?? window).scrollBy({ top: by, behavior: "instant" });
  };
  const drift = under ? under.getBoundingClientRect().top - held.y : 0;
  if (drift >= 1) {
    return scroll(
      Math.min(drift, Math.max(0, message.getBoundingClientRect().top - top - MESSAGE_GAP)),
    );
  }
  const over = message.getBoundingClientRect().bottom + MESSAGE_GAP - bottom;
  if (over >= 1) {
    scroll(
      Math.min(
        over,
        under ? Math.max(0, under.getBoundingClientRect().top - top - MESSAGE_GAP) : over,
      ),
    );
  }
}

function whenPressLands(open: () => void) {
  let done = false;
  const landed = () => {
    if (done) return;
    done = true;
    document.removeEventListener("click", landed, true);
    setTimeout(open);
  };
  document.addEventListener("click", landed, true);
  setTimeout(landed, CLICK_WAIT_MS);
}

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
  useLayoutEffect(() => {
    const h = held.current;
    held.current = null;
    const msg = h && messageFor(h.k);
    if (!h || !msg) return;
    keepUnderPointer(h, msg);
  }, [shown]);
  const show = (keys: string[]) => setShown((s) => new Set([...s, ...keys]));
  const leave = (k: string) => (e: FocusEvent) => {
    const p = pressed.current;
    const pressing = e.timeStamp - p.at < PRESS_WINDOW_MS;
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
    whenPressLands(open);
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

const ALL_PROGRAMS = [...new Set(Object.values(DEGREE_PROGRAMS).flat())];

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
          className="absolute inset-x-0 top-full z-40 mt-3 float-panel"
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
                className={`flex min-h-12 cursor-pointer items-center rounded-[20px] px-4 py-2 type-display text-lg leading-snug text-diploma/86 roomy:px-7 ${
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
                className="absolute top-1/2 right-2 grid size-11 -translate-y-1/2 cursor-pointer place-items-center rounded-full text-diploma/70 transition-[background-color,color] hover:bg-diploma/13 hover:text-diploma active:bg-diploma/13 focus-visible:outline-offset-0 roomy:right-3 roomy:size-12"
              >
                <i aria-hidden className="ic x size-5.5" />
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
          className="mt-4 inline-flex min-h-12 cursor-pointer items-center rounded-full px-5 text-left type-display text-base font-semibold text-diploma/86 transition-[background-color,color] hover:bg-diploma/13 hover:text-diploma active:bg-diploma/13 roomy:px-8 roomy:text-lg"
        >
          + Add a second major or minor
        </button>
      )}
    </div>
  );
}

function useKeepDroppedFilesInPage() {
  useEffect(() => {
    const stop = (event: DragEvent) => event.preventDefault();
    addEventListener("dragover", stop);
    addEventListener("drop", stop);
    return () => {
      removeEventListener("dragover", stop);
      removeEventListener("drop", stop);
    };
  }, []);
}

function Career({ me, d, set, check, onUpload }: BodyProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [slow, hold] = useSlowHold(Boolean(busy));
  const [problem, setProblem] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const was = useRef(me.resume);
  const settle = useRef<(ok: boolean) => void>(() => {});

  // The new name shows once the member's row has it, so the field never flashes back to the old one.
  useEffect(() => {
    if (!busy || me.resume === was.current) return;
    settle.current(true);
    void hold().then(() => setBusy(null));
  }, [busy, me.resume, hold]);

  useKeepDroppedFilesInPage();

  async function attach(file: File | undefined) {
    if (!file || busy) return;
    was.current = me.resume;
    setBusy(file.name);
    setProblem(null);
    onUpload(
      new Promise((resolve) => {
        settle.current = resolve;
      }),
    );
    const result = await uploadResume(file);
    // The same file again leaves the member's row as it was, so nothing else would end the upload.
    const same =
      result.ok &&
      was.current?.name === result.resume.name &&
      was.current?.size === result.resume.size;
    if (result.ok && !same) return;
    await hold();
    setProblem(result.ok ? null : result.error);
    setBusy(null);
    settle.current(result.ok);
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
          className={`group flex cursor-pointer items-center gap-3 rounded-full bg-navy/45 type-display tracking-[-0.01em] has-focus-visible:outline-2 has-focus-visible:outline-offset-4 has-focus-visible:outline-burdell has-aria-invalid:outline-2 has-aria-invalid:outline-offset-4 has-aria-invalid:outline-azalea has-aria-disabled:cursor-wait ${over ? "outline-2 outline-offset-4 outline-burdell" : ""} ${field}`}
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
            className={`min-w-0 flex-1 truncate ${slow ? "text-diploma/70" : busy || me.resume ? "" : "text-diploma/60"}`}
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
            className={`flex-none ${slow ? "font-sans text-fine font-normal tracking-normal text-diploma/60" : "text-base font-semibold text-diploma/86 transition-colors group-hover:text-diploma roomy:text-lg"}`}
          >
            {slow ? "Uploading…" : me.resume ? "Replace" : "Upload"}
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
  onUpload: (settled: Promise<boolean>) => void;
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
              {...check.field("firstName")}
              {...textInput()}
              aria-label="First name"
              autoComplete="given-name"
              placeholder="First name"
              value={d.firstName}
              onChange={(event) => set({ firstName: event.target.value })}
            />
            <input
              {...check.field("lastName", "firstName")}
              {...textInput("last")}
              aria-label="Last name"
              autoComplete="family-name"
              placeholder="Last name"
              value={d.lastName}
              onChange={(event) => set({ lastName: event.target.value })}
            />
          </div>
          <Problem
            id="firstName-error"
            text={
              check.error("firstName") && check.error("lastName")
                ? "Enter your first and last name."
                : (check.error("firstName") ?? check.error("lastName"))
            }
          />
        </div>
      );
    case "pronouns":
      return (
        <>
          <div data-block>
            <Rows
              id="choice"
              labelledBy={titleId}
              describedBy={check.describedBy("choice")}
              options={PRONOUN_OPTIONS}
              value={d.choice}
              quiet={SELF_DESCRIBE}
              onPick={(v, settled) => {
                set({ choice: v });
                if (v !== SELF_DESCRIBE) return onPick(settled, { choice: v });
                onPick(false);
                if (settled)
                  requestAnimationFrame(() => document.getElementById("writeIn")?.focus());
              }}
            />
            <Problem id="choice-error" text={check.error("choice")} />
          </div>
          {d.choice === SELF_DESCRIBE ? (
            <div data-block className="mt-4">
              <input
                {...check.field("writeIn")}
                {...textInput("last")}
                autoCapitalize="none"
                aria-label="Your pronouns"
                placeholder="Your pronouns"
                value={d.writeIn}
                onChange={(event) => set({ writeIn: event.target.value })}
              />
              <Problem id="writeIn-error" text={check.error("writeIn")} />
            </div>
          ) : null}
        </>
      );
    case "contact":
      return (
        <div data-block>
          <div className="grid grid-cols-1 gap-4">
            <input
              {...check.field("personalEmail")}
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
          <Problem id="personalEmail-error" text={check.error("personalEmail")} />
          <Problem id="phone-error" text={check.error("phone")} />
        </div>
      );
    case "year":
      return rows(
        "standing",
        CLASS_STANDINGS,
        d.standing,
        (standing) => setStanding(d, standing),
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
              id="season"
              labelledBy={`${titleId} term-label`}
              describedBy={check.describedBy("season")}
              options={SEASONS}
              selected={d.season ? [d.season] : []}
              onToggle={(season) => set({ season })}
              single
            />
            <Problem id="season-error" text={check.error("season")} />
          </div>
          <div data-block className="mt-6">
            <p id="year-label" className="mb-2.5 type-label text-diploma/70">
              Year
            </p>
            <Chips
              id="year"
              labelledBy={`${titleId} year-label`}
              describedBy={check.describedBy("year")}
              options={YEAR_OPTIONS}
              selected={d.year ? [d.year] : []}
              onToggle={(year) => set({ year })}
              single
            />
            <Problem id="year-error" text={check.error("year")} />
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
              id="races"
              labelledBy={titleId}
              describedBy={check.describedBy("races")}
              note="question-note"
              options={RACES}
              selected={d.races}
              onToggle={(value) => set({ races: toggleRace(d.races, value) })}
              quiet={PREFER_NOT}
            />
            <Problem id="races-error" text={check.error("races")} />
          </div>
        </>
      );
    case "gender":
      return rows("gender", GENDERS, d.gender, (gender) => ({ gender }), PREFER_NOT);
    case "first-gen":
      return rows(
        "firstGeneration",
        YES_NO,
        d.firstGeneration,
        (firstGeneration) => ({ firstGeneration }),
        PREFER_NOT,
      );
    case "low-income":
      return rows("lowIncome", YES_NO, d.lowIncome, (lowIncome) => ({ lowIncome }), PREFER_NOT);
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
