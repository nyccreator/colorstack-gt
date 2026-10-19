import { api } from "@colorstack-gt/backend/convex/_generated/api";
import { GROUPS, type Group, isOptional } from "@colorstack-gt/backend/convex/lib/groups";
import {
  createFileRoute,
  Navigate,
  useLocation,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { useMutation } from "convex/react";
import {
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { z } from "zod";

import { Bar, Waiting } from "@/components/frame";
import {
  errorsFor,
  type Draft,
  draftFrom,
  failureText,
  passes,
  useSave,
} from "@/components/member/draft";
import { TITLES } from "@/components/member/groups";
import { breaks, summary } from "@/components/member/summary";
import { Message } from "@/components/message";
import { FirstName, pin, Progress, Tick } from "@/components/onboarding/controls";
import { Body, QUESTIONS, type Slug, useChecks } from "@/components/onboarding/screens";
import { type Answers, type Profile, useMember } from "@/lib/member";
import { BUSY_AFTER, cue, ENTER, slide, still } from "@/lib/motion";
import { requireSession } from "@/lib/session";

const searchSchema = z.object({
  q: z
    .enum(QUESTIONS.map((question) => question.slug))
    .optional()
    .catch(undefined),
  gated: z.boolean().optional().catch(undefined),
  edit: z.boolean().optional().catch(undefined),
});

type Search = z.infer<typeof searchSchema>;

export const Route = createFileRoute("/onboarding")({
  validateSearch: searchSchema,
  beforeLoad: requireSession,
  head: ({ match }) => ({
    meta: [
      { title: `${match.search.edit ? "Your answers" : "Welcome"} · ColorStack at Georgia Tech` },
    ],
  }),
  component: Onboarding,
});

// Every navigation inside onboarding writes this into its history entry, so Back and Forward carry it.
type Hop = {
  from?: Slug;
  opened?: { group: Group; listIndex: number };
};

declare module "@tanstack/react-router" {
  interface HistoryState {
    hop?: Hop;
  }
}

type Screen =
  | { kind: "hub" }
  | { kind: "redirect"; search: Search }
  | { kind: "list" }
  | { kind: "ask"; at: number; editing: boolean; backToList: boolean };

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
const BEAT = 350;

type Arrival = { dir: number; group?: Group };
const isText = (el: unknown): el is HTMLInputElement =>
  el instanceof HTMLInputElement && !["checkbox", "file", "radio"].includes(el.type);

const PINNED = `${pin} tall:unpinned tall:mt-8 short:unpinned short:mt-6`;

const flowing = () => {
  const el = document.querySelector<HTMLElement>("[data-actions]");
  return el && getComputedStyle(el).position !== "fixed" ? el : null;
};

function rise(el: HTMLElement | null | undefined, dir: number) {
  if (still() || !el) return null;
  const actions = flowing();
  if (actions) slide(actions, true, dir);
  document
    .querySelector("[data-pin] [data-skip]:not([inert])")
    ?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: ENTER });
  return slide(el, true, dir);
}

function Shell({ pinned, children }: { pinned?: boolean; children?: ReactNode }) {
  return (
    <div className="min-h-dvh bg-blue-bright px-edge">
      <Bar signOut />
      <main
        className={`mx-auto w-full max-w-gate pt-anchor ${
          pinned ? "pb-pinned tall:pb-16 short:pb-10" : "pb-10 roomy:pb-16"
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
          <button
            type="button"
            data-skip
            onClick={onSkip}
            disabled={Boolean(busy)}
            inert={hideSkip || undefined}
            className={`btn-quiet flex-none overflow-hidden whitespace-nowrap transition-[max-width,margin,padding,opacity] duration-200 motion-reduce:transition-none tall:order-last tall:mt-3 tall:mr-0 tall:self-center ${
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
          className="btn-solid"
        >
          {busy ?? label}
        </button>
      </div>
    </div>
  );
}

const words = (n: number, one: string, many: string) => `${COUNT[n] ?? n} ${n === 1 ? one : many}`;

function SavedTick({ onDone }: { onDone: () => void }) {
  const el = useRef<HTMLSpanElement>(null);
  useEffect(() => (el.current ? cue(el.current, onDone, 180) : undefined), [onDone]);
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
  onGo: (open: Group) => void;
  onOpen: (group: Group) => void;
}) {
  const review = me.complete;
  const title = useRef<HTMLHeadingElement>(null);
  const arrival = useRef(enter);
  const [ticked, setTicked] = useState(enter && enter.dir > 0 ? (enter.group ?? null) : null);
  const untick = useCallback(() => setTicked(null), []);
  const open = GROUPS.findIndex((group) => !me.saved[group]);
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
      (question) => !me.saved[question.group] && isOptional(question.group) === optional,
    ).length;
  const extra = left(true);
  const answered = QUESTIONS.length - left(false) - extra;
  return (
    <Shell pinned>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          onGo(GROUPS[open] ?? "name");
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
              const done = me.saved[group];
              const n = QUESTIONS.filter((question) => question.group === group).length;
              const text = (
                <span className="min-w-0 flex-1">
                  <span className="block text-fine text-diploma/70 roomy:text-label">
                    {TITLES[group]}
                  </span>
                  <span
                    className={`mt-0.5 block type-display text-control leading-tight tracking-[-0.005em] wrap-break-word roomy:text-value ${
                      done ? "" : "text-diploma/64"
                    }`}
                  >
                    {done
                      ? breaks(summary(me, group))
                      : `${isOptional(group) ? "Optional · " : ""}${n} ${n === 1 ? "question" : "questions"}`}
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
                      onClick={() => (done || review ? onOpen(group) : onGo(group))}
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
  const check = useChecks(errorsFor(question.fields, draft));
  const save = useSave();
  const skipGroup = useMutation(api.members.skip);
  const [pending, setPending] = useState(false);
  const [slow, setSlow] = useState(false);
  const [upload, setUpload] = useState<Promise<boolean> | null>(null);
  // Pressing on during an upload waits for it under Saving… and stays on this question if it fails.
  async function afterUpload() {
    if (!upload) return true;
    setPending(true);
    setSlow(true);
    const ok = await upload;
    if (!ok) setSlow(false);
    setPending(false);
    return ok;
  }
  const [problem, setProblem] = useState<string | null>(null);
  const [beat, setBeat] = useState(0);
  const alive = useRef(true);
  const lastOfGroup = QUESTIONS[at + 1]?.group !== question.group;
  const chosen =
    question.slug === "career"
      ? Boolean(draft.linkedin.trim() || draft.github.trim() || me.resume || upload)
      : question.slug === "goals"
        ? draft.lookingFor.length > 0
        : question.slug === "hobbies" && draft.hobbies.length > 0;
  const skip = !edit && "skip" in question ? question.skip : undefined;
  const busy = pending && slow ? "Saving…" : undefined;
  const tapSave = useRef<Promise<unknown> | null>(null);
  const held = () => locked() || pending;

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

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
    // If browser Back unmounted this question while it saved, the member stays where they went.
    if (!alive.current) return;
    const following = QUESTIONS[at + 1];
    if (following && !edit) await go(following.slug);
    else finish();
  }

  async function next() {
    if (held() || !check.ready()) return;
    if (!lastOfGroup) return void go(QUESTIONS[at + 1]!.slug);
    const started = tapSave.current;
    tapSave.current = null;
    if (!(await afterUpload())) return;
    await onward(() => started ?? save(question.group, draft, me));
  }

  async function skipThis() {
    if (held()) return;
    if (question.slug === "career") {
      if (!(await afterUpload())) return;
      set({ linkedin: "", github: "", resumeBook: false });
      return onward(() => skipGroup({ group: "materials" }));
    }
    if (question.slug === "goals") {
      set({ lookingFor: [] });
      return void go("hobbies");
    }
    const d = { ...draft, hobbies: [] };
    set({ hobbies: [] });
    await onward(() => save("interests", d, me));
  }

  const advance = useEffectEvent(() => void next());
  useEffect(() => {
    if (!beat) return;
    const timer = setTimeout(advance, BEAT);
    return () => clearTimeout(timer);
  }, [beat]);

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
    // oxlint-disable-next-line react/immutability -- The box is a DOM node passed in as a ref.
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
              onUpload={(settled) => {
                setUpload(settled);
                void settled.finally(() => setUpload((u) => (u === settled ? null : u)));
              }}
              onPick={(settled, patch) => {
                const moves = settled && "pick" in question;
                setBeat((n) => (moves ? n + 1 : 0));
                const started =
                  moves && lastOfGroup && patch
                    ? save(question.group, { ...draft, ...patch }, me)
                    : null;
                started?.catch(() => {});
                tapSave.current = started;
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

function reach(at: number, draft: Draft, me: Profile) {
  const group = QUESTIONS[at]!.group;
  for (let i = 0; i < at; i++) {
    const other = QUESTIONS[i]!;
    if (other.group === group) {
      if (!passes(other.fields, draft)) return i;
    } else if (!me.complete && !me.saved[other.group]) {
      const same = QUESTIONS.flatMap((x, j) => (x.group === other.group ? [j] : []));
      return same.find((j) => !passes(QUESTIONS[j]!.fields, draft)) ?? same.at(-1)!;
    }
  }
  return at;
}

const indexOf = (q: Slug | undefined) =>
  q ? QUESTIONS.findIndex((question) => question.slug === q) : -1;

function screenFor(
  me: Profile,
  draft: Draft,
  search: Search,
  completeAtLoad: boolean,
  hop: Hop | undefined,
): Screen {
  const at = indexOf(search.q);
  if (at < 0) {
    if (me.complete && !search.edit) return { kind: "hub" };
    if (GROUPS.every((group) => !me.saved[group]))
      return { kind: "redirect", search: { q: "name" } };
    return { kind: "list" };
  }
  const { group } = QUESTIONS[at]!;
  const editing = (Boolean(search.edit) || completeAtLoad) && (me.complete || me.saved[group]);
  const gated = search.gated || undefined;
  if (search.edit && !editing) return { kind: "redirect", search: { q: search.q, gated } };
  const blocked = reach(at, draft, me);
  if (blocked !== at) {
    return {
      kind: "redirect",
      search: { q: QUESTIONS[blocked]!.slug, edit: search.edit || undefined, gated },
    };
  }
  const firstOfGroup = QUESTIONS[at - 1]?.group !== group;
  return {
    kind: "ask",
    at,
    editing,
    backToList: firstOfGroup && (editing || hop?.opened?.group === group),
  };
}

function Flow({ me, answers, search }: { me: Profile; answers: Answers | null; search: Search }) {
  const navigate = useNavigate();
  const router = useRouter();
  const hop = useLocation({ select: (location) => location.state.hop });
  const [draft, setDraft] = useState(() => draftFrom(me, answers));
  const [completeAtLoad] = useState(me.complete);
  const [arrival, setArrival] = useState<Arrival | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const moving = useRef(false);
  const historyIndex = () => router.history.location.state.__TSR_index;
  const gated = Boolean(search.gated);
  const at = indexOf(search.q);
  const [seen, setSeen] = useState({ at, from: at });
  if (seen.at !== at) setSeen({ at, from: seen.at });
  const from = seen.at === at ? seen.from : seen.at;
  const screen = screenFor(me, draft, search, completeAtLoad, hop);
  const editing = screen.kind === "ask" && screen.editing;
  const backToList = screen.kind === "ask" && screen.backToList;

  async function leave(up: boolean) {
    moving.current = true;
    const el = box.current;
    if (!el) return;
    el.inert = true;
    if (still()) return;
    const dir = up ? 1 : -1;
    const actions = flowing();
    if (actions) slide(actions, false, dir);
    await slide(el, false, dir).finished.catch(() => {});
  }

  async function go(slug: Slug, open = editing, opened = hop?.opened) {
    if (moving.current) return;
    await leave(true);
    await navigate({
      to: "/onboarding",
      search: { q: slug, edit: open || undefined, gated: gated || undefined },
      state: { hop: { from: search.q, opened } },
    });
  }

  // Going back through history when it holds the question before keeps browser Back and Forward in step with the arrow.
  async function back() {
    const to = QUESTIONS[at - 1]?.slug;
    if (moving.current) return;
    if (backToList) return toList(false);
    if (!to) return;
    await leave(false);
    if (hop?.from === to) router.history.back();
    else {
      await navigate({
        to: "/onboarding",
        search: { q: to, edit: editing || undefined, gated: gated || undefined },
        state: { hop: { opened: hop?.opened } },
      });
    }
  }

  // Back at the list, history is where it was before the group opened, so the browser's Back doesn't reopen it.
  async function toList(up: boolean) {
    if (moving.current) return;
    await leave(up);
    setArrival({ dir: up ? 1 : -1, group: QUESTIONS[at]?.group });
    const depth = hop?.opened ? historyIndex() - hop.opened.listIndex : 0;
    if (depth > 0) router.history.go(-depth);
    else {
      await navigate({
        to: "/onboarding",
        search: { edit: true, gated: gated || undefined },
        replace: true,
      });
    }
  }

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

  const settle = useCallback(() => {
    moving.current = false;
    setArrival(null);
  }, []);

  const opening = (group: Group) => ({ group, listIndex: historyIndex() });
  const firstOf = (group: Group) => QUESTIONS.find((question) => question.group === group)!.slug;

  switch (screen.kind) {
    case "hub":
      return <Shell>{<Navigate to="/hub" replace />}</Shell>;
    case "redirect":
      return <Shell>{<Navigate to="/onboarding" search={screen.search} replace />}</Shell>;
    case "list":
      return (
        <Welcome
          me={me}
          gated={gated}
          box={box}
          enter={arrival}
          settle={settle}
          onGo={(open) => {
            if (me.complete) return void leave(true).then(() => navigate({ to: "/hub" }));
            void go(firstOf(open), false, opening(open));
          }}
          onOpen={(group) => void go(firstOf(group), true, opening(group))}
        />
      );
    case "ask":
      return (
        <Ask
          key={search.q}
          me={me}
          draft={draft}
          set={(patch) => setDraft((d) => ({ ...d, ...patch }))}
          at={at}
          from={from}
          box={box}
          locked={() => moving.current}
          settle={settle}
          edit={screen.editing}
          go={go}
          back={at > 0 || backToList ? () => void back() : undefined}
          backLabel={backToList ? "Back to the list" : undefined}
          finish={() => void finish()}
        />
      );
  }
}

function Onboarding() {
  const member = useMember();
  const search = Route.useSearch();
  if (member.status !== "ready") {
    return (
      <Shell>
        <Waiting under={false} />
      </Shell>
    );
  }
  return <Flow me={member.me} answers={member.answers} search={search} />;
}
