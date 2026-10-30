import {
  memo,
  type ReactNode,
  type RefObject,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { appear, cue, MOVE, still } from "@/lib/motion";

import { announce } from "../frame";
import { TaskLink } from "../member/task-link";
import { inlineLink } from "../onboarding/controls";
import { type ClubEvent, isPast } from "./data";

const ATLANTA = "America/New_York";
const format = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-US", { timeZone: ATLANTA, ...options });
const LONG = format({ weekday: "long", month: "long", day: "numeric" });
const LONG_YEAR = format({ weekday: "long", month: "long", day: "numeric", year: "numeric" });
const SHORT = format({ weekday: "short", month: "short", day: "numeric" });
const SHORT_YEAR = format({ month: "short", day: "numeric", year: "numeric" });
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
  dayNo(e.startsAt) !== dayNo(e.endsAt)
    ? `${time(e.startsAt)} to ${SHORT.format(e.endsAt)}, ${time(e.endsAt)}`
    : half(e.startsAt) === half(e.endsAt)
      ? `${clock(e.startsAt)} to ${time(e.endsAt)}`
      : `${time(e.startsAt)} to ${time(e.endsAt)}`;
const dayNo = (t: number) =>
  Date.UTC(+part(DAY, t, "year"), +part(DAY, t, "month") - 1, +part(DAY, t, "day")) / 86_400_000;
const sameYear = (t: number, now: number) => YEAR.format(t) === YEAR.format(now);
export const monthOf = (t: number, now: number) =>
  sameYear(t, now) ? MONTH.format(t) : `${MONTH.format(t)} ${YEAR.format(t)}`;
export const shortOf = (t: number, now: number) =>
  sameYear(t, now) ? SHORT.format(t) : SHORT_YEAR.format(t);
const longOf = (t: number, now: number) => (sameYear(t, now) ? LONG : LONG_YEAR).format(t);

export function semesterOf(t: number) {
  const month = +part(DAY, t, "month");
  return `${month <= 4 ? "Spring" : month <= 7 ? "Summer" : "Fall"} ${YEAR.format(t)}`;
}

function ago(e: ClubEvent, now: number) {
  const days = dayNo(now) - dayNo(e.startsAt);
  if (days <= 0) return "Earlier today";
  if (days === 1) return "Yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 61) return `${Math.round(days / 7)} weeks ago`;
  if (days < 365) return `${Math.round(days / 30.44)} months ago`;
  const years = Math.round(days / 365);
  return years === 1 ? "A year ago" : `${years} years ago`;
}

export function away(e: ClubEvent, now: number) {
  if (isPast(e, now)) return ago(e, now);
  const days = dayNo(e.startsAt) - dayNo(now);
  if (days <= 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 7) return WEEKDAY.format(e.startsAt);
  if (days < 14) return `In ${days} days`;
  return `In ${Math.round(days / 7)} weeks`;
}

export const STICKER = "/assets/art/stickers/event.svg";

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

type Look = Pick<ClubEvent, "flier">;

const TALLEST = 9 / 16;
const WIDEST = 3;
const shapeOr = (blank: number, e: Look) => {
  const shape = e.flier ? e.flier.width / e.flier.height : blank;
  return shape > 0 && Number.isFinite(shape) ? Math.min(WIDEST, Math.max(TALLEST, shape)) : blank;
};
export const tileShape = (e: Look) => shapeOr(4 / 5, e);
export const stackShape = (e: Look) => shapeOr(1, e);

export function Picture({
  event,
  width,
  height,
  lazy,
  past,
  children,
}: {
  event: Look;
  width: number;
  height: number;
  lazy?: boolean;
  past?: boolean;
  children?: ReactNode;
}) {
  const [broken, setBroken] = useState(false);
  const flier = broken ? undefined : event.flier;
  return (
    <span className={flier ? "pic" : "pic tone"} style={{ width, height }}>
      {flier ? (
        <img
          src={flier.src}
          width={flier.width}
          height={flier.height}
          loading={lazy ? "lazy" : "eager"}
          decoding="async"
          alt=""
          onError={() => setBroken(true)}
        />
      ) : (
        <img src={STICKER} alt="" />
      )}
      {past ? <i className="wash" aria-hidden /> : null}
      {children}
    </span>
  );
}

export function Actions({
  event,
  mode,
  now,
}: {
  event: ClubEvent;
  mode: "tile" | "corner";
  now: number;
}) {
  if (isPast(event, now)) return null;
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

export function fitStack(probe: HTMLElement, shapes: number[], widest: number, room: number): Fit {
  const tallestAt = (width: number, t: number) => {
    probe.style.width = `${width}px`;
    probe.style.setProperty("--t", String(t));
    return Math.max(
      ...Array.from(probe.children, (c, i) => (c as HTMLElement).offsetHeight + width / shapes[i]!),
    );
  };
  let k = 1;
  let couldFitAtMost = 1;
  for (;;) {
    const width = Math.floor(widest * k);
    const t = Math.max(TYPE_FLOOR, k);
    if (k <= couldFitAtMost || k <= WIDTH_FLOOR) {
      const tallest = tallestAt(width, t);
      if (tallest <= room || k <= WIDTH_FLOOR) return { width, t };
      if (k === 1) couldFitAtMost = room / tallest + STEP;
    }
    k = Math.max(WIDTH_FLOOR, k - STEP);
  }
}

function About({ text, offScreen }: { text: string; offScreen?: boolean }) {
  const body = useRef<HTMLParagraphElement>(null);
  const heightBefore = useRef<number | null>(null);
  const [long, setLong] = useState(false);
  const [open, setOpen] = useState(false);
  if (offScreen && open) setOpen(false);

  useLayoutEffect(() => {
    if (open) return;
    const el = body.current!;
    const measure = () => {
      if (!el.getAnimations().length) setLong(el.scrollHeight > el.clientHeight + 1);
    };
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(el);
    return () => watch.disconnect();
  }, [open, text]);

  useLayoutEffect(() => {
    const el = body.current!;
    const from = heightBefore.current;
    heightBefore.current = null;
    if (from === null || still()) return;
    el.animate([{ height: `${from}px` }, { height: `${el.offsetHeight}px` }], {
      duration: 200,
      easing: MOVE,
    });
  }, [open]);

  return (
    <>
      <p ref={body} className={open ? "ds open" : "ds"}>
        {text}
      </p>
      {long ? (
        <button
          type="button"
          className={`more ${inlineLink}`}
          aria-expanded={open}
          onClick={() => {
            heightBefore.current = body.current!.offsetHeight;
            setOpen(!open);
          }}
        >
          {open ? "Read less" : "Read more"}
        </button>
      ) : null}
    </>
  );
}

export const Details = memo(function Details({
  event,
  now,
  next,
  eyebrow,
  title,
  offScreen,
}: {
  event: ClubEvent;
  now: number;
  next: boolean;
  eyebrow?: boolean;
  title?: RefObject<HTMLHeadingElement | null>;
  offScreen?: boolean;
}) {
  return (
    <div className="det">
      {eyebrow ? (
        <span className="eyb">
          {isPast(event, now)
            ? `Past event · ${away(event, now)}`
            : next
              ? `Next up · ${away(event, now)}`
              : away(event, now)}
        </span>
      ) : null}
      <h2 ref={title} tabIndex={-1} className="ttl">
        {event.title}
      </h2>
      <About text={event.about} offScreen={offScreen} />
      <div className="fx">
        <p>
          <span className="tl">
            <span className="m3">{MON.format(event.startsAt)}</span>
            <span className="dd">{DATE.format(event.startsAt)}</span>
          </span>
          <span className="fk">
            <b>{longOf(event.startsAt, now)}</b>
            <span>{span(event)}</span>
          </span>
        </p>
        {event.place ? (
          <p>
            <span className="tl">
              <i className="ic pin" aria-hidden />
            </span>
            <span className="fk">
              <b>{event.place}</b>
            </span>
          </p>
        ) : null}
      </div>
    </div>
  );
});

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
      // Safari can't tell whether the menu fell back to opening above its button, so the corner it grows from is read here.
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
