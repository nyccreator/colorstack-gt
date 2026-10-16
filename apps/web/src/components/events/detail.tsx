import { api } from "@colorstack-gt/backend/convex/_generated/api";
import { useMutation } from "convex/react";
import {
  type ReactNode,
  type RefObject,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { APPEAR, still } from "@/lib/motion";

import { TASKS } from "../onboarding/options";
import type { ClubEvent } from "./data";

// Every date and time reads in Atlanta's time, wherever the member is.
const format = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", ...options });
const LONG = format({ weekday: "long", month: "long", day: "numeric" });
export const SHORT = format({ weekday: "short", month: "short", day: "numeric" });
const MON = format({ month: "short" });
const DATE = format({ day: "numeric" });
const WEEKDAY = format({ weekday: "long" });
const MONTH = format({ month: "long" });
const YEAR = format({ year: "numeric" });
const CLOCK = format({ hour: "numeric", minute: "2-digit" });
const DAY = format({ year: "numeric", month: "numeric", day: "numeric" });

const part = (f: Intl.DateTimeFormat, t: number, type: Intl.DateTimeFormatPartTypes) =>
  f.formatToParts(t).find((p) => p.type === type)?.value ?? "";
const clock = (t: number) => `${part(CLOCK, t, "hour")}:${part(CLOCK, t, "minute")}`;
const half = (t: number) => part(CLOCK, t, "dayPeriod").toLowerCase();
const time = (t: number) => `${clock(t)} ${half(t)}`;
const span = (e: ClubEvent) =>
  half(e.startsAt) === half(e.endsAt)
    ? `${clock(e.startsAt)} to ${time(e.endsAt)}`
    : `${time(e.startsAt)} to ${time(e.endsAt)}`;
const dayNo = (t: number) =>
  Date.UTC(+part(DAY, t, "year"), +part(DAY, t, "month") - 1, +part(DAY, t, "day")) / 86_400_000;
export const monthOf = (t: number, now: number) =>
  YEAR.format(t) === YEAR.format(now) ? MONTH.format(t) : `${MONTH.format(t)} ${YEAR.format(t)}`;

// "This" and "Next" before a weekday read differently to different people, so a day this week is named alone and the
// week after counts its days.
export function away(e: ClubEvent, now: number) {
  const days = dayNo(e.startsAt) - dayNo(now);
  if (days <= 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 7) return WEEKDAY.format(e.startsAt);
  if (days < 14) return `In ${days} days`;
  return `In ${Math.round(days / 7)} weeks`;
}

const stamp = (t: number) => new Date(t).toISOString().replace(/[-:]|\.\d{3}/g, "");
const google = (e: ClubEvent) =>
  `https://calendar.google.com/calendar/render?${new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${stamp(e.startsAt)}/${stamp(e.endsAt)}`,
    details: e.about,
    location: e.place,
  })}`;
const outlook = (e: ClubEvent) =>
  `https://outlook.office.com/calendar/0/deeplink/compose?${new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: e.title,
    startdt: new Date(e.startsAt).toISOString(),
    enddt: new Date(e.endsAt).toISOString(),
    body: e.about,
    location: e.place,
  })}`;
const escape = (s: string) => s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\r?\n/g, "\\n");

function download(e: ClubEvent) {
  const text = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ColorStack at Georgia Tech//Events//EN",
    "BEGIN:VEVENT",
    `UID:${e.id}@colorstackgt.org`,
    `DTSTAMP:${stamp(Date.now())}`,
    `DTSTART:${stamp(e.startsAt)}`,
    `DTEND:${stamp(e.endsAt)}`,
    `SUMMARY:${escape(e.title)}`,
    `LOCATION:${escape(e.place)}`,
    `DESCRIPTION:${escape(e.about)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/calendar" }));
  a.download = `${e.id}.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function announce(text: string) {
  const status = document.getElementById("events-status");
  if (!status) return;
  status.textContent = "";
  requestAnimationFrame(() => (status.textContent = text));
}

type Look = Pick<ClubEvent, "art" | "tone" | "flier">;

// A flier keeps its own shape. Without one, the event's colour and sticker stand in: 4:5 in the gallery, square over
// its details.
export const tileShape = (e: Look) => (e.flier ? e.flier.width / e.flier.height : 0.8);
export const stackShape = (e: Look) => (e.flier ? e.flier.width / e.flier.height : 1);

export function Picture({
  event,
  width,
  height,
  children,
}: {
  event: Look;
  width: number;
  height: number;
  children?: ReactNode;
}) {
  return (
    <span
      className={event.flier ? "pic" : "pic tone"}
      data-tone={event.flier ? undefined : event.tone}
      style={{ width, height }}
    >
      {event.flier ? (
        <img src={event.flier.src} width={event.flier.width} height={event.flier.height} alt="" />
      ) : (
        <img src={`/assets/art/stickers/${event.art}.svg`} alt="" />
      )}
      {children}
    </span>
  );
}

export function Zoom({ event }: { event: ClubEvent }) {
  if (!event.flier) return null;
  return (
    <a
      className="zm"
      href={event.flier.src}
      target="_blank"
      rel="noreferrer"
      aria-label={`Open the ${event.title} flier full size`}
    >
      <i className="ic zoom" aria-hidden />
    </a>
  );
}

export type Fit = { width: number; t: number };

// The flier and its details share one width and shrink together, at one size for every event, until the tallest fits
// its room. The type stops shrinking at 88% and the width at 72%; past both, the stack scrolls.
export function fitStack(probe: HTMLElement, shapes: number[], widest: number, room: number): Fit {
  let k = 1;
  for (;;) {
    const width = Math.floor(widest * k);
    const t = Math.max(0.88, k);
    probe.style.width = `${width}px`;
    probe.style.setProperty("--t", String(t));
    const tallest = Math.max(
      ...Array.from(probe.children, (c, i) => (c as HTMLElement).offsetHeight + width / shapes[i]!),
    );
    if (tallest <= room || k <= 0.72) return { width, t };
    k = Math.max(0.72, k - 0.02);
  }
}

export function Details({
  event,
  now,
  next,
  eyebrow,
  narrow,
  title,
}: {
  event: ClubEvent;
  now: number;
  next: boolean;
  eyebrow?: boolean;
  narrow?: boolean;
  title?: RefObject<HTMLHeadingElement | null>;
}) {
  return (
    <div className={narrow ? "det narrow" : "det"}>
      {eyebrow ? (
        <span className="eyb">{next ? `Next up · ${away(event, now)}` : away(event, now)}</span>
      ) : null}
      <h2 ref={title} tabIndex={-1} className="ttl">
        {event.title}
      </h2>
      <p className="ds">{event.about}</p>
      <div className="fx">
        <p>
          <span className="tl">
            <span className="m3">{MON.format(event.startsAt)}</span>
            <span className="dd">{DATE.format(event.startsAt)}</span>
          </span>
          <span className="fk">
            <b>{LONG.format(event.startsAt)}</b>
            <span>{span(event)}</span>
          </span>
        </p>
        <p>
          <span className="tl">
            <i className="ic pin" aria-hidden />
          </span>
          <span className="fk">
            <b>{event.place}</b>
          </span>
        </p>
      </div>
      <div className="acts">
        <Add event={event} />
        {event.link ? (
          <a className="q" href={event.link.href} target="_blank" rel="noreferrer">
            {event.link.label}
            <i className="ic out" aria-hidden />
          </a>
        ) : null}
      </div>
    </div>
  );
}

const INSTAGRAM = TASKS.find((task) => task.value === "instagram")!;

// With nothing planned, the way to hear about what comes next: the You page's Instagram link.
export function Nothing() {
  const completeTask = useMutation(api.members.completeTask);
  const record = () => void completeTask({ task: "instagram" });
  return (
    <div className="det">
      <h2 className="ttl">Nothing on the calendar yet</h2>
      <p className="ds">New events show up here as soon as they’re posted.</p>
      <div className="follow">
        <a
          href={INSTAGRAM.href}
          target="_blank"
          rel="noreferrer"
          onClick={record}
          onAuxClick={(e) => e.button === 1 && record()}
        >
          <img src="/assets/logos/instagram.png" alt="Instagram" />
          <b>Follow @colorstackgt</b>
          <span>{INSTAGRAM.detail}</span>
          <i className="ic out" aria-hidden />
        </a>
      </div>
    </div>
  );
}

// One button for every calendar, since members use different ones. Once one is chosen it says so for a moment, then
// turns back; nothing remembers it.
export function Add({ event, tile }: { event: ClubEvent; tile?: boolean }) {
  const [open, setOpen] = useState(false);
  const [added, setAdded] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLUListElement>(null);
  const face = useRef<HTMLSpanElement>(null);
  const shown = useRef(false);
  const id = useId();

  // "Added" arrives, holds, then leaves more slowly than it came, as Saved does on the You page.
  useLayoutEffect(() => {
    if (!shown.current) {
      shown.current = true;
      return;
    }
    const el = face.current;
    const reduce = still();
    el?.animate(
      [
        { opacity: 0, transform: added && !reduce ? "translateX(-6px)" : "none" },
        { opacity: 1, transform: "none" },
      ],
      { duration: reduce ? 120 : 200, easing: APPEAR },
    );
    if (!added) return;
    const timer = setTimeout(() => {
      const fade = el?.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 400,
        easing: "ease-in",
        fill: "forwards",
      });
      void (fade?.finished ?? Promise.resolve()).then(
        () => setAdded(false),
        () => {},
      );
    }, 2800);
    return () => clearTimeout(timer);
  }, [added]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const outside = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) close();
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      close();
      button.current?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape, true);
    addEventListener("scroll", close, true);
    addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape, true);
      removeEventListener("scroll", close, true);
      removeEventListener("resize", close);
    };
  }, [open]);

  // The menu is fixed beside its button, so a row that scrolls sideways can't clip it. It opens upward when there
  // isn't room below, and an opened event's bar counts as no room.
  useLayoutEffect(() => {
    const el = menu.current;
    const b = button.current;
    if (!el || !b) return;
    const r = b.getBoundingClientRect();
    const floor = innerHeight - (b.closest(".view") ? 96 : 8);
    const left = Math.min(
      Math.max(8, tile ? r.right - el.offsetWidth : r.left),
      innerWidth - el.offsetWidth - 8,
    );
    el.style.left = `${left}px`;
    el.style.top = `${r.bottom + 8 + el.offsetHeight <= floor ? r.bottom + 8 : r.top - 8 - el.offsetHeight}px`;
  }, [open, tile]);

  const done = (where: string) => {
    setOpen(false);
    setAdded(true);
    button.current?.focus({ preventScroll: true });
    announce(`${event.title} added to ${where}.`);
  };

  return (
    <div ref={box} className="add">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={tile ? `Add ${event.title} to your calendar` : undefined}
        className={`${tile ? "ra" : "solid"}${added ? " added" : ""}`}
        onClick={() => setOpen(!open)}
      >
        <span ref={face} key={String(added)} className="face">
          <i className={`ic ${added ? "tick" : tile ? "add" : "cal"}`} aria-hidden />
          {tile ? null : (
            <span className="word">{added ? "Added to calendar" : "Add to calendar"}</span>
          )}
        </span>
      </button>
      {open ? (
        <ul ref={menu} id={id} className="menu">
          <li>
            <a
              href={google(event)}
              target="_blank"
              rel="noreferrer"
              onClick={() => done("Google Calendar")}
            >
              Google Calendar
            </a>
          </li>
          <li>
            <a
              href={outlook(event)}
              target="_blank"
              rel="noreferrer"
              onClick={() => done("Outlook")}
            >
              Outlook
            </a>
          </li>
          <li>
            <button
              type="button"
              onClick={() => {
                download(event);
                done("your calendar");
              }}
            >
              Apple Calendar or other (.ics)
            </button>
          </li>
        </ul>
      ) : null}
    </div>
  );
}
