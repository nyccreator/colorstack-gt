import { api } from "@colorstack-gt/backend/convex/_generated/api";
import {
  createFileRoute,
  Navigate,
  redirect,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import {
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { z } from "zod";

import { Bar, Waiting } from "@/components/frame";
import { quiet, solid } from "@/components/gate";
import { Message } from "@/components/message";
import { FirstName, pin, Progress, Tick } from "@/components/onboarding/controls";
import { APPEAR, BUSY_AFTER, ENTER, EXIT, still } from "@/lib/motion";
import { breaks } from "@/components/you/page";
import { CLASS_STANDINGS, HOBBIES, LOOKING_FOR, STAGES } from "@/components/onboarding/options";
import {
  Body,
  checksFor,
  type Draft,
  draftFrom,
  failureText,
  type Group,
  passes,
  type Profile,
  QUESTIONS,
  saved,
  type Slug,
  useChecks,
  useSave,
} from "@/components/onboarding/screens";

const SLUGS = QUESTIONS.map((question) => question.slug) as unknown as [Slug, ...Slug[]];

const searchSchema = z.object({
  q: z.enum(SLUGS).optional().catch(undefined),
  gated: z.boolean().optional().catch(undefined),
  edit: z.boolean().optional().catch(undefined),
});

export const Route = createFileRoute("/onboarding")({
  validateSearch: searchSchema,
  beforeLoad: ({ context }) => {
    if (!context.isAuthenticated) throw redirect({ to: "/sign-in" });
  },
  head: ({ match }) => ({
    meta: [
      { title: `${match.search.edit ? "Your answers" : "Welcome"} · ColorStack at Georgia Tech` },
    ],
  }),
  component: Onboarding,
});

const GROUPS: Group[] = ["name", "contact", "studies", "materials", "interests", "background"];
const OPTIONAL: ReadonlySet<Group> = new Set(["materials", "interests"]);
const COUNT = [
  "No",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
];

const TYPED: ReadonlySet<Slug> = new Set(["name", "contact", "major", "career"]);

type Arrival = { dir: number; group?: Group };
const isText = (el: unknown): el is HTMLInputElement =>
  el instanceof HTMLInputElement && !["checkbox", "file", "radio"].includes(el.type);

// The main button is pinned to the bottom of the screen until the screen is tall enough to show it under the longest
// question, but not on a screen too short to spare the room.
const PINNED = `${pin} tall:static tall:mt-8 tall:bg-transparent tall:p-0 tall:before:hidden [@media(max-height:499px)]:static [@media(max-height:499px)]:mt-6 [@media(max-height:499px)]:bg-transparent [@media(max-height:499px)]:p-0 [@media(max-height:499px)]:before:hidden`;

const flowing = () => {
  const el = document.querySelector<HTMLElement>("[data-actions]");
  return el && getComputedStyle(el).position !== "fixed" ? el : null;
};

// The answers and, when it sits in the flow, the main button rise in together.
function rise(el: HTMLElement | null | undefined, dir: number) {
  if (still() || !el) return null;
  const frames = [
    { opacity: 0, transform: `translateY(${16 * dir}px)` },
    { opacity: 1, transform: "none" },
  ];
  flowing()?.animate(frames, { duration: 300, easing: ENTER });
  document
    .querySelector("[data-pin] [data-skip]:not([inert])")
    ?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: ENTER });
  return el.animate(frames, { duration: 300, easing: ENTER });
}

function Shell({ pinned, children }: { pinned?: boolean; children?: ReactNode }) {
  return (
    <div className="min-h-dvh bg-blue-bright px-edge">
      <Bar signOut />
      <main
        className={`mx-auto w-full max-w-gate pt-anchor ${
          pinned
            ? "pb-[calc(var(--spacing-control-lg)+5rem)] tall:pb-16 [@media(max-height:499px)]:pb-10"
            : "pb-10 roomy:pb-16"
        }`}
      >
        {children}
      </main>
    </div>
  );
}

function Actions({
  pinned,
  busy,
  label,
  skip,
  hideSkip,
  onSkip,
}: {
  pinned: boolean;
  busy?: string;
  label: string;
  skip?: string;
  hideSkip?: boolean;
  onSkip?: () => void;
}) {
  return (
    <div
      data-actions
      data-pin={pinned ? "" : undefined}
      className={pinned ? PINNED : "mt-6 roomy:mt-8"}
    >
      <div className="mx-auto flex w-full max-w-gate items-center tall:flex-col tall:items-stretch">
        {skip ? (
          // Once something is chosen Skip folds away, so Continue widens rather than jumping.
          <button
            type="button"
            data-skip
            onClick={onSkip}
            disabled={Boolean(busy)}
            inert={hideSkip || undefined}
            className={`${quiet} flex-none overflow-hidden whitespace-nowrap transition-[max-width,margin,padding,opacity] duration-200 motion-reduce:transition-none tall:order-last tall:mt-3 tall:mr-0 tall:self-center ${
              hideSkip ? "mr-0 max-w-0 px-0! opacity-0 tall:hidden" : "mr-3 max-w-60"
            }`}
          >
            {skip}
          </button>
        ) : null}
        <button
          type="submit"
          disabled={Boolean(busy)}
          aria-busy={busy ? true : undefined}
          className={solid}
        >
          {busy ?? label}
        </button>
      </div>
    </div>
  );
}

const words = (n: number, one: string, many: string) => `${COUNT[n] ?? n} ${n === 1 ? one : many}`;
const labelled = (
  options: readonly { value: string; label: string }[],
  values: readonly string[] = [],
) => options.filter((option) => values.includes(option.value)).map((option) => option.label);
const listed = (parts: string[]) =>
  parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}` : (parts[0] ?? "");

// What each saved group says on the list, as the You page shows it; background answers are never echoed.
function summary(me: Profile, group: Group) {
  switch (group) {
    case "name":
      return [
        me.name && `${me.name.firstName} ${me.name.lastName}`,
        me.name?.pronouns?.replace(/ \/ /g, "\u00a0/\u00a0"),
      ]
        .filter(Boolean)
        .join(" · ");
    case "contact":
      return me.contact
        ? `${me.contact.personalEmail} · ${me.contact.phone.replace(/-/g, "\u2011")}`
        : "";
    case "studies":
      return me.studies
        ? `${labelled(CLASS_STANDINGS, [me.studies.classStanding])[0]} · ${me.studies.major}`
        : "";
    case "materials": {
      const parts = [
        me.resume ? "Resume" : "",
        me.materials?.linkedin ? "LinkedIn" : "",
        me.materials?.github ? "GitHub" : "",
      ].filter(Boolean);
      return listed(parts) || "Skipped";
    }
    case "background":
      return "Saved privately";
    case "interests": {
      const all = [
        ...labelled(LOOKING_FOR, me.interests?.lookingFor),
        ...labelled(HOBBIES, me.interests?.hobbies),
      ];
      if (!all.length) return "Skipped";
      return all.length > 3
        ? `${all.slice(0, 2).join(", ")} +\u00a0${all.length - 2}\u00a0more`
        : all.join(", ");
    }
  }
}

// As on the You page, a tick stands where the row's arrow was, then leaves, once the group it opens has saved.
function SavedTick({ onDone }: { onDone: () => void }) {
  const el = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const tick = el.current;
    if (!tick) return;
    tick.animate(
      [
        { opacity: 0, transform: still() ? "none" : "translateX(-6px)" },
        { opacity: 1, transform: "none" },
      ],
      {
        duration: still() ? 120 : 200,
        delay: 180,
        easing: APPEAR,
        fill: "backwards",
      },
    );
    const timer = setTimeout(() => {
      tick
        .animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: 400,
          easing: "ease-in",
          fill: "forwards",
        })
        .finished.then(onDone, () => {});
    }, 2800);
    return () => clearTimeout(timer);
  }, [onDone]);
  return (
    <span ref={el} className="flex-none text-burdell">
      <Tick className="size-4.5" />
      <span className="sr-only">Saved</span>
    </span>
  );
}

function Welcome({
  me,
  gated,
  box,
  enter,
  settle,
  onGo,
  onOpen,
}: {
  me: Profile;
  gated: boolean;
  box: RefObject<HTMLDivElement | null>;
  enter: Arrival | null;
  settle: () => void;
  onGo: () => void;
  onOpen: (group: Group) => void;
}) {
  // A member who has finished sees the same list as their answers, every part open to change.
  const review = me.complete;
  const title = useRef<HTMLHeadingElement>(null);
  const arrival = useRef(enter);
  const [ticked, setTicked] = useState(enter && enter.dir > 0 ? (enter.group ?? null) : null);
  const untick = useCallback(() => setTicked(null), []);
  const open = GROUPS.findIndex((group) => !saved(me, group));
  // The list rises in the way the member went, as a question does; back from a group, that group's row takes focus.
  // Arriving fresh, the group still to answer comes into view, clear of the pinned button, though the title keeps focus.
  useLayoutEffect(() => {
    const { dir, group } = arrival.current ?? { dir: 1 };
    window.scrollTo(0, 0);
    const motion = rise(box.current, dir);
    if (motion) motion.finished.then(settle, settle);
    else settle();
    const find = (g?: Group) =>
      g ? box.current?.querySelector<HTMLElement>(`[data-group="${g}"]`) : null;
    const row = find(group);
    (row ?? title.current)?.focus({ preventScroll: true });
    (row ?? find(GROUPS[open]))?.scrollIntoView({ block: "nearest" });
  }, [box, settle, open]);
  const left = (optional: boolean) =>
    QUESTIONS.filter(
      (question) => !saved(me, question.group) && OPTIONAL.has(question.group) === optional,
    ).length;
  const extra = left(true);
  const answered = QUESTIONS.length - left(false) - extra;
  return (
    <Shell pinned>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          onGo();
        }}
      >
        <Progress
          at={answered}
          from={answered}
          total={QUESTIONS.length}
          label={`${answered} of ${QUESTIONS.length} questions answered`}
          bare
        />
        <div ref={box}>
          <h1
            ref={title}
            tabIndex={-1}
            className="@container type-display text-title text-balance wrap-break-word hyphens-auto outline-none"
          >
            {review ? (
              "Your answers"
            ) : gated ? (
              "A few things first"
            ) : me.name ? (
              <>
                Welcome back, <FirstName name={me.name.firstName} />
              </>
            ) : (
              "Welcome back"
            )}
          </h1>
          <p className="mt-2 text-subtitle text-pretty text-diploma/70">
            {review
              ? "Change any part, then come back here."
              : gated
                ? "Answer these to finish joining."
                : `${words(left(false), "question", "questions")} left${
                    extra
                      ? `, and ${words(extra, "optional one", "optional ones").toLowerCase()}`
                      : ""
                  }.`}
          </p>
          <ol className="mt-6 rounded-3xl bg-navy/36 p-1 roomy:mt-8">
            {GROUPS.map((group, i) => {
              const done = saved(me, group);
              const n = QUESTIONS.filter((question) => question.group === group).length;
              const text = (
                <span className="min-w-0 flex-1">
                  <span className="block text-fine text-diploma/70 roomy:text-label">
                    {STAGES[i]?.title}
                  </span>
                  <span
                    className={`mt-0.5 block type-heading text-control leading-tight tracking-[-0.005em] wrap-break-word roomy:text-value ${
                      done ? "" : "text-diploma/64"
                    }`}
                  >
                    {done
                      ? breaks(summary(me, group))
                      : `${OPTIONAL.has(group) ? "Optional · " : ""}${n} ${n === 1 ? "question" : "questions"}`}
                  </span>
                </span>
              );
              const row =
                "flex min-h-16 w-full items-center gap-4 rounded-[20px] px-4 py-2.75 text-left roomy:px-5";
              return (
                <li key={group}>
                  {done || i === open ? (
                    <button
                      type="button"
                      data-group={group}
                      onClick={() => (done || review ? onOpen(group) : onGo())}
                      className={`${row} cursor-pointer transition-[background-color] hover:bg-diploma/5 focus-visible:outline-offset-2 active:bg-diploma/8`}
                    >
                      {text}
                      {ticked === group ? (
                        <SavedTick onDone={untick} />
                      ) : (
                        <i aria-hidden className="ic chev size-4.5 opacity-45" />
                      )}
                    </button>
                  ) : (
                    <div className={`${row} opacity-65`}>
                      {text}
                      <span className="sr-only">, opens after the ones above</span>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
        <Actions pinned label={review ? "Done" : "Continue"} />
      </form>
    </Shell>
  );
}

function Ask({
  me,
  draft,
  set,
  at,
  from,
  box,
  locked,
  settle,
  edit,
  go,
  back,
  backLabel,
  finish,
}: {
  me: Profile;
  draft: Draft;
  set: (patch: Partial<Draft>) => void;
  at: number;
  from: number;
  box: RefObject<HTMLDivElement | null>;
  locked: () => boolean;
  settle: () => void;
  edit: boolean;
  go: (slug: Slug) => Promise<void>;
  back?: () => void;
  backLabel?: string;
  finish: () => void;
}) {
  const question = QUESTIONS[at]!;
  const titleId = useId();
  const title = useRef<HTMLHeadingElement>(null);
  const check = useChecks(checksFor(question.slug, draft));
  const save = useSave();
  const skipGroup = useMutation(api.members.skip);
  const [pending, setPending] = useState(false);
  const [slow, setSlow] = useState(false);
  // The resume field says it's uploading; pressing on waits for the upload rather than saying so again.
  const upload = useRef<{ on: boolean; done?: (ok: boolean) => void }>({ on: false });
  const [uploading, setUploading] = useState(false);
  const uploaded = () =>
    upload.current.on
      ? new Promise<boolean>((resolve) => {
          upload.current.done = resolve;
        })
      : Promise.resolve(true);
  // Continue or Skip pressed during an upload waits for it, saying Saving… meanwhile since that's what the press will
  // do, and stays put with its message if it failed.
  async function afterUpload() {
    if (!upload.current.on) return true;
    setPending(true);
    setSlow(true);
    const ok = await uploaded();
    if (!ok) setSlow(false);
    setPending(false);
    return ok;
  }
  const [problem, setProblem] = useState<string | null>(null);
  const [beat, setBeat] = useState(0);
  const alive = useRef(true);
  const lastOfGroup = QUESTIONS[at + 1]?.group !== question.group;
  // Skip goes once something is chosen, since skipping would throw it away.
  const chosen =
    question.slug === "career"
      ? Boolean(draft.linkedin.trim() || draft.github.trim() || me.resume || uploading)
      : question.slug === "goals"
        ? draft.lookingFor.length > 0
        : question.slug === "hobbies" && draft.hobbies.length > 0;
  const skip = !edit && "skip" in question ? question.skip : undefined;
  const busy = pending && slow ? "Saving…" : undefined;
  // A group's last single answer starts saving when it's tapped, so the beat before moving on covers the save.
  const early = useRef<Promise<unknown> | null>(null);
  const held = () => locked() || pending;

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // A quick save never flashes Saving… on the button.
  async function onward(store: () => Promise<unknown>) {
    setPending(true);
    setProblem(null);
    const shown = setTimeout(() => setSlow(true), BUSY_AFTER);
    try {
      await store();
    } catch (failure) {
      clearTimeout(shown);
      setSlow(false);
      setPending(false);
      return setProblem(failureText(failure));
    }
    clearTimeout(shown);
    // The member may have gone back while it saved, and then stays where they went.
    if (!alive.current) return;
    const following = QUESTIONS[at + 1];
    if (following && !edit) await go(following.slug);
    else finish();
  }

  async function next() {
    if (held() || !check.ready()) return;
    if (!lastOfGroup) return void go(QUESTIONS[at + 1]!.slug);
    const started = early.current;
    early.current = null;
    if (!(await afterUpload())) return;
    await onward(() => started ?? save(question.group, draft, me));
  }

  async function skipThis() {
    if (held()) return;
    if (question.slug === "career") {
      if (!(await afterUpload())) return;
      set({ linkedin: "", github: "", resumeBook: false });
      return onward(() => skipGroup({ step: 4 }));
    }
    if (question.slug === "goals") {
      set({ lookingFor: [] });
      return void go("hobbies");
    }
    const d = { ...draft, hobbies: [] };
    set({ hobbies: [] });
    await onward(() => save("interests", d, me));
  }

  // A single answer moves on by itself after a beat long enough to see it chosen, saving the newest draft.
  const latest = useRef(next);
  useLayoutEffect(() => {
    latest.current = next;
  });
  useEffect(() => {
    if (!beat) return;
    const timer = setTimeout(() => void latest.current(), 350);
    return () => clearTimeout(timer);
  }, [beat]);

  // Each question rises in from the way the member is going and takes focus: the first field with a mouse, or else the
  // question itself.
  // Changing a group's answers, the bar counts that group's questions only, since it ends back at the list.
  const section = QUESTIONS.filter((x) => x.group === question.group);
  const before = QUESTIONS[from];
  const place = edit
    ? {
        at: section.indexOf(question) + 1,
        from: before?.group === question.group ? section.indexOf(before) + 1 : 0,
        total: section.length,
      }
    : { at: at + 1, from: from + 1, total: QUESTIONS.length };

  const enter = useRef(at < from ? -1 : 1);
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    // Only the first moment of arriving ignores taps, so a double tap on the last answer can't answer this one too.
    const el = box.current;
    if (el) el.style.pointerEvents = "none";
    const open = setTimeout(() => el && (el.style.pointerEvents = ""), 120);
    const motion = rise(el, enter.current);
    if (motion) motion.finished.then(settle, settle);
    else settle();
    const first = matchMedia("(pointer: fine)").matches
      ? box.current?.querySelector<HTMLInputElement>(
          "input:not([type=file]):not([type=checkbox]):not(:disabled)",
        )
      : null;
    (first ?? title.current)?.focus({ preventScroll: true });
    return () => clearTimeout(open);
  }, [box, settle]);

  function keys(event: KeyboardEvent<HTMLFormElement>) {
    const t = event.target;
    if (event.key !== "Enter" || event.defaultPrevented || !isText(t)) return;
    if (t.enterKeyHint === "next") {
      event.preventDefault();
      const fields = [...event.currentTarget.querySelectorAll("input")].filter(isText);
      return fields[fields.indexOf(t) + 1]?.focus();
    }
    // A phone's keyboard closes on Return, as its own check above the keys does.
    if (matchMedia("(pointer: coarse)").matches) {
      event.preventDefault();
      t.blur();
    }
  }

  return (
    <Shell pinned>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void next();
        }}
        onKeyDown={keys}
      >
        <Progress
          at={place.at}
          from={place.from}
          total={place.total}
          disabled={Boolean(busy)}
          back={backLabel}
          onBack={back && (() => !held() && back())}
        />
        <div ref={box} inert={pending || undefined}>
          <h1
            ref={title}
            id={titleId}
            tabIndex={-1}
            aria-describedby="progress"
            className="type-display text-title text-balance outline-none"
          >
            {question.title}
          </h1>
          {"note" in question ? (
            <p id="question-note" className="mt-2 text-subtitle text-pretty text-diploma/70">
              {question.note}
            </p>
          ) : null}
          <div
            className="mt-6 roomy:mt-8"
            {...(TYPED.has(question.slug)
              ? { role: "group", "aria-labelledby": titleId, "aria-describedby": "progress" }
              : {})}
          >
            <Body
              slug={question.slug}
              me={me}
              d={draft}
              set={set}
              check={check}
              titleId={titleId}
              setUploading={(on, failed) => {
                upload.current.on = on;
                setUploading(on);
                if (on) return;
                upload.current.done?.(!failed);
                upload.current.done = undefined;
              }}
              onPick={(settled, patch) => {
                const moves = settled && "pick" in question;
                setBeat((n) => (moves ? n + 1 : 0));
                const started =
                  moves && lastOfGroup && patch
                    ? save(question.group, { ...draft, ...patch }, me)
                    : null;
                started?.catch(() => {});
                early.current = started;
              }}
            />
          </div>
          {problem ? <Message tone="error">{problem}</Message> : null}
        </div>
        <Actions
          pinned
          busy={busy}
          label={edit && lastOfGroup ? "Save" : at === QUESTIONS.length - 1 ? "Finish" : "Continue"}
          skip={skip}
          hideSkip={chosen}
          onSkip={() => void skipThis()}
        />
      </form>
    </Shell>
  );
}

// Until a member has finished, a question shows only once every group before it is saved, or skipped if optional,
// and the questions before it in its group are answered; anything else goes to the first one still open.
function reach(at: number, draft: Draft, me: Profile) {
  const group = QUESTIONS[at]!.group;
  for (let i = 0; i < at; i++) {
    const other = QUESTIONS[i]!;
    if (other.group === group) {
      if (!passes(other.slug, draft)) return i;
    } else if (!me.complete && !saved(me, other.group)) {
      const same = QUESTIONS.flatMap((x, j) => (x.group === other.group ? [j] : []));
      return same.find((j) => !passes(QUESTIONS[j]!.slug, draft)) ?? same.at(-1)!;
    }
  }
  return at;
}

function Flow({
  me,
  answers,
  q,
  gated,
  edit,
}: {
  me: Profile;
  answers: Parameters<typeof draftFrom>[1];
  q?: Slug;
  gated: boolean;
  edit: boolean;
}) {
  const navigate = useNavigate();
  const router = useRouter();
  const [draft, setDraft] = useState(() => draftFrom(me, answers));
  const box = useRef<HTMLDivElement>(null);
  const moving = useRef(false);
  const arrive = useRef<Arrival | null>(null);
  // The group opened from the list, and where the list sits in history.
  const opened = useRef<{ group: Group; from: number } | null>(null);
  const place = () => router.history.location.state.__TSR_index;
  const [finished] = useState(me.complete);
  const trail = useRef<Slug[]>([]);
  const at = q ? QUESTIONS.findIndex((question) => question.slug === q) : -1;
  // Only a group already saved, or any group once the member has finished, opens to be changed.
  const editing = (edit || finished) && at >= 0 && (me.complete || saved(me, QUESTIONS[at]!.group));
  const prev = useRef(at);
  const from = prev.current;
  useEffect(() => {
    prev.current = at;
    if (q && trail.current.at(-1) === q) trail.current.pop();
  }, [at, q]);

  // While one question leaves and the next arrives, nothing on either takes a tap.
  async function leave(up: boolean) {
    moving.current = true;
    const el = box.current;
    if (!el) return;
    el.inert = true;
    if (still()) return;
    const frames = [
      { opacity: 1, transform: "none" },
      { opacity: 0, transform: `translateY(${up ? -12 : 12}px)` },
    ];
    const timing = {
      duration: 140,
      easing: EXIT,
      fill: "forwards" as const,
    };
    flowing()?.animate(frames, timing);
    await el.animate(frames, timing).finished.catch(() => {});
  }

  // A group opened from the list stays in that group, and its last question saves and goes back to the list.
  async function go(slug: Slug, open = editing) {
    if (moving.current) return;
    if (q) trail.current.push(q);
    await leave(true);
    await navigate({
      to: "/onboarding",
      search: { q: slug, edit: open || undefined, gated: gated || undefined },
    });
  }

  // The back arrow steps back through history when the question before is where the member came from.
  async function back() {
    const to = QUESTIONS[at - 1]?.slug;
    if (moving.current) return;
    if (backToList) return toList(false);
    if (!to) return;
    await leave(false);
    if (trail.current.at(-1) === to) {
      trail.current.pop();
      router.history.back();
    } else {
      await navigate({
        to: "/onboarding",
        search: { q: to, edit: editing || undefined, gated: gated || undefined },
      });
    }
  }

  // Back at the list, history is where it was before the group opened, so the browser's Back doesn't reopen it.
  async function toList(up: boolean) {
    if (moving.current) return;
    trail.current = [];
    await leave(up);
    arrive.current = { dir: up ? 1 : -1, group: QUESTIONS[at]?.group };
    const depth = opened.current ? place() - opened.current.from : 0;
    opened.current = null;
    if (depth > 0) router.history.go(-depth);
    else {
      await navigate({
        to: "/onboarding",
        search: { edit: true, gated: gated || undefined },
        replace: true,
      });
    }
  }

  // Leaving onboarding, the bar and the pinned button go with the question.
  async function finish() {
    if (editing) return toList(true);
    if (!still()) {
      for (const el of document.querySelectorAll<HTMLElement>("[data-progress], [data-pin]")) {
        el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, fill: "forwards" });
      }
    }
    await leave(true);
    await navigate({ to: "/hub" });
  }

  const settle = useRef(() => {
    moving.current = false;
    arrive.current = null;
  }).current;

  const firstOfGroup = at >= 0 && QUESTIONS[at - 1]?.group !== QUESTIONS[at]!.group;
  const backToList = firstOfGroup && (editing || opened.current?.group === QUESTIONS[at]!.group);

  if (at < 0) {
    if (me.complete && !edit) return <Shell>{<Navigate to="/hub" replace />}</Shell>;
    const open = GROUPS.find((group) => !saved(me, group));
    const start = QUESTIONS.find((question) => question.group === open)?.slug ?? "name";
    if (GROUPS.every((group) => !saved(me, group))) {
      return <Shell>{<Navigate to="/onboarding" search={{ q: "name" }} replace />}</Shell>;
    }
    return (
      <Welcome
        me={me}
        gated={gated}
        box={box}
        enter={arrive.current}
        settle={settle}
        onGo={() => {
          if (me.complete) return void leave(true).then(() => navigate({ to: "/hub" }));
          opened.current = { group: open!, from: place() };
          void go(start, false);
        }}
        onOpen={(group) => {
          opened.current = { group, from: place() };
          void go(QUESTIONS.find((question) => question.group === group)!.slug, true);
        }}
      />
    );
  }

  const question = QUESTIONS[at]!;
  const blocked = reach(at, draft, me);
  if (blocked !== at) {
    return (
      <Shell>
        {
          <Navigate
            to="/onboarding"
            search={{
              q: QUESTIONS[blocked]!.slug,
              edit: edit || undefined,
              gated: gated || undefined,
            }}
            replace
          />
        }
      </Shell>
    );
  }

  return (
    <Ask
      key={question.slug}
      me={me}
      draft={draft}
      set={(patch) => setDraft((d) => ({ ...d, ...patch }))}
      at={at}
      from={from}
      box={box}
      locked={() => moving.current}
      settle={settle}
      edit={editing}
      go={go}
      back={at > 0 || backToList ? () => void back() : undefined}
      backLabel={backToList ? "Back to the list" : undefined}
      finish={() => void finish()}
    />
  );
}

function Onboarding() {
  const me = useQuery(api.members.me);
  const answers = useQuery(api.members.myDemographics);
  const { q, gated, edit } = Route.useSearch();

  if (me === undefined || answers === undefined) {
    return (
      <Shell>
        <Waiting under={false} />
      </Shell>
    );
  }
  if (me === null) return <Shell>{<Navigate to="/sign-in" replace />}</Shell>;
  return <Flow me={me} answers={answers} q={q} gated={Boolean(gated)} edit={Boolean(edit)} />;
}
