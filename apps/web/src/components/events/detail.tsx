import {
  type ReactNode,
  type RefObject,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { appear, cue } from "@/lib/motion";

import { announce } from "../frame";
import { TaskLink } from "../member/task-link";
import type { ClubEvent } from "./data";

const ATLANTA = "America/New_York";
const format = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-US", { timeZone: ATLANTA, ...options });
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

// "This" and "Next" before a weekday are ambiguous, so the copy never uses them.
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

type Look = Pick<ClubEvent, "art" | "tone" | "flier">;

const ratio = (e: Look, blank: number) => (e.flier ? e.flier.width / e.flier.height : blank);
export const tileShape = (e: Look) => ratio(e, 4 / 5);
export const stackShape = (e: Look) => ratio(e, 1);

export function Picture({
  event,
  width,
  height,
  eager,
  children,
}: {
  event: Look;
  width: number;
  height: number;
  eager?: boolean;
  children?: ReactNode;
}) {
  return (
    <span
      className={event.flier ? "pic" : "pic tone"}
      data-tone={event.flier ? undefined : event.tone}
      style={{ width, height }}
    >
      {event.flier ? (
        <img
          src={event.flier.src}
          width={event.flier.width}
          height={event.flier.height}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          alt=""
        />
      ) : (
        <img src={`/assets/art/stickers/${event.art}.svg`} alt="" />
      )}
      {children}
    </span>
  );
}

export function Actions({ event, mode }: { event: ClubEvent; mode: "tile" | "corner" }) {
  return (
    <div className={mode === "tile" ? "acts" : "cor"}>
      {event.link ? (
        <a
          className={mode === "tile" ? "ra" : "zm"}
          href={event.link.href}
          target="_blank"
          rel="noreferrer"
          aria-label={`${event.link.label} for ${event.title}`}
        >
          <i className="ic qr" aria-hidden />
        </a>
      ) : null}
      <Add event={event} mode={mode} />
    </div>
  );
}

export type Fit = { width: number; t: number };

const TYPE_FLOOR = 0.88;
const WIDTH_FLOOR = 0.72;
const STEP = 0.02;

// Every measure lays out each event's details, and no part of a stack shrinks faster than its width, so a step more
// than one above room / full-size height can't fit and is skipped.
export function fitStack(probe: HTMLElement, shapes: number[], widest: number, room: number): Fit {
  let k = 1;
  let reach = 1;
  for (;;) {
    const width = Math.floor(widest * k);
    const t = Math.max(TYPE_FLOOR, k);
    if (k <= reach || k <= WIDTH_FLOOR) {
      probe.style.width = `${width}px`;
      probe.style.setProperty("--t", String(t));
      const tallest = Math.max(
        ...Array.from(
          probe.children,
          (c, i) => (c as HTMLElement).offsetHeight + width / shapes[i]!,
        ),
      );
      if (tallest <= room || k <= WIDTH_FLOOR) return { width, t };
      if (k === 1) reach = room / tallest + STEP;
    }
    k = Math.max(WIDTH_FLOOR, k - STEP);
  }
}

export function Details({
  event,
  now,
  next,
  eyebrow,
  title,
}: {
  event: ClubEvent;
  now: number;
  next: boolean;
  eyebrow?: boolean;
  title?: RefObject<HTMLHeadingElement | null>;
}) {
  return (
    <div className="det">
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
    </div>
  );
}

export function Nothing() {
  return (
    <div className="det">
      <h2 className="ttl">Nothing on the calendar yet</h2>
      <p className="ds">New events show up here as soon as they’re posted.</p>
      <div className="follow">
        <TaskLink
          task="instagram"
          logo="/assets/logos/instagram.png"
          title="Follow @colorstackgt"
        />
      </div>
    </div>
  );
}

function Add({ event, mode }: { event: ClubEvent; mode: "tile" | "corner" }) {
  const [added, setAdded] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLUListElement>(null);
  const face = useRef<HTMLSpanElement>(null);
  const shown = useRef(false);
  const id = useId();
  const anchor = `--${id}`;

  useLayoutEffect(() => {
    if (!shown.current) {
      shown.current = true;
      return;
    }
    const el = face.current;
    if (!el) return;
    if (added) return cue(el, () => setAdded(false));
    appear(el, { slide: false });
  }, [added]);

  useEffect(() => {
    const m = menu.current;
    if (!m) return;
    const escape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      m.hidePopover();
      button.current?.focus();
    };
    const toggled = (e: ToggleEvent) => {
      if (e.newState !== "open") return document.removeEventListener("keydown", escape, true);
      document.addEventListener("keydown", escape, true);
      // CSS can't tell whether the menu fell back to opening above its button, so the corner it grows from is read here.
      const above = m.getBoundingClientRect().top < button.current!.getBoundingClientRect().top;
      m.style.transformOrigin = above ? "right bottom" : "right top";
    };
    m.addEventListener("toggle", toggled);
    return () => {
      m.removeEventListener("toggle", toggled);
      document.removeEventListener("keydown", escape, true);
    };
  }, []);

  const done = (where: string) => {
    menu.current?.hidePopover();
    setAdded(true);
    button.current?.focus({ preventScroll: true });
    if (button.current) announce(button.current, `${event.title} added to ${where}.`);
  };

  return (
    <div className="add">
      <button
        ref={button}
        type="button"
        popoverTarget={id}
        aria-label={`Add ${event.title} to your calendar`}
        className={`${mode === "tile" ? "ra" : "zm"}${added ? " added" : ""}`}
        style={{ anchorName: anchor }}
      >
        <span ref={face} key={String(added)} className="face">
          <i className={`ic ${added ? "tick" : "add"}`} aria-hidden />
        </span>
      </button>
      <ul ref={menu} id={id} popover="auto" className="menu" style={{ positionAnchor: anchor }}>
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
          <a href={outlook(event)} target="_blank" rel="noreferrer" onClick={() => done("Outlook")}>
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
    </div>
  );
}
