import {
  type CSSProperties,
  type InputHTMLAttributes,
  type KeyboardEvent,
  useLayoutEffect,
  useRef,
} from "react";

import { ENTER, still } from "@/lib/motion";

// A first name in a title never breaks mid-word: one too long for the line sets itself smaller, sized from the title's
// width (the title is the size container).
export function FirstName({ name }: { name: string }) {
  return (
    <span
      className="text-[min(1em,calc(200cqi/var(--n)))] whitespace-nowrap hyphens-none"
      style={{ "--n": Math.max(name.length, 1) } as CSSProperties}
    >
      {name}
    </span>
  );
}

export const inlineLink = "border-b border-current pb-px text-diploma hover:text-burdell";
// A main button pinned to the bottom of the screen, under a fade that shows when answers run on beneath it. It sits as
// far from the foot as the Events and You dock.
export const pin =
  "fixed inset-x-0 bottom-0 z-30 bg-blue-bright px-edge pt-3 pb-6 before:pointer-events-none before:absolute before:inset-x-0 before:bottom-full before:h-6 before:bg-linear-to-t before:from-blue-bright before:to-blue-bright/0";

export function Tick({ className = "" }: { className?: string }) {
  return <i aria-hidden className={`ic tick ${className}`} />;
}

type Option<T extends string> = { value: T; label: string };

// Two columns keep the text where single answers have it and give a long label the circle's side instead.
export const answer = (on: boolean, quiet = false, wide = false) =>
  `flex h-control-lg w-full cursor-pointer items-center justify-between rounded-full pl-5 text-left type-heading text-subtitle tracking-tight transition-[background-color,color] duration-180 roomy:pl-8 ${
    wide ? "gap-2 pr-5.5 roomy:pr-4" : "gap-3 pr-5.5"
  } ${
    on
      ? "bg-diploma text-navy"
      : `bg-diploma/13 hover:bg-diploma/19 hover:text-diploma active:bg-diploma/24 ${quiet ? "text-diploma/86" : "text-diploma"}`
  }`;

export function Ring({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={`grid size-7.5 flex-none place-items-center rounded-full transition-[background-color,box-shadow] duration-180 ${
        on ? "bg-navy text-diploma" : "ring-2 ring-diploma/30 ring-inset"
      }`}
    >
      {on ? <Tick className="size-4.5" /> : null}
    </span>
  );
}

// The site's address stays in front of the field, so the member types only the name after it.
export function Prefixed({
  prefix,
  className = "",
  ...input
}: { prefix: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={`prefixed ${className}`}>
      <span aria-hidden>{prefix}</span>
      <input {...input} />
    </label>
  );
}

// One answer is a radio group: one tab stop, and the arrow keys move the choice without moving on.
function arrows<T extends string>(
  event: KeyboardEvent<HTMLButtonElement>,
  i: number,
  options: readonly Option<T>[],
  choose: (value: T) => void,
) {
  const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
  if (!step) return;
  event.preventDefault();
  const n = (i + step + options.length) % options.length;
  choose(options[n]!.value);
  (event.currentTarget.parentElement?.children[n] as HTMLElement | undefined)?.focus();
}

export function Rows<T extends string>({
  id,
  labelledBy,
  describedBy,
  options,
  value,
  quiet,
  wide,
  onPick,
}: {
  id: string;
  labelledBy: string;
  describedBy?: string;
  options: readonly Option<T>[];
  value: T | "";
  quiet?: T;
  wide?: boolean;
  onPick: (value: T, settled: boolean) => void;
}) {
  const any = options.some((option) => option.value === value);
  return (
    <div
      id={id}
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-invalid={describedBy ? true : undefined}
      className={`grid gap-3 ${wide ? "roomy:grid-cols-2" : ""}`}
    >
      {options.map((option, i) => {
        const on = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on || (!any && i === 0) ? 0 : -1}
            onClick={() => onPick(option.value, true)}
            onKeyDown={(event) => arrows(event, i, options, (v) => onPick(v, false))}
            className={answer(on, option.value === quiet, wide)}
          >
            <span className="min-w-0 truncate">{option.label}</span>
            <Ring on={on} />
          </button>
        );
      })}
    </div>
  );
}

// Several answers are toggle buttons; `single` makes the set a radio group. A chip keeps its tick's room either way, so
// choosing one never reflows the set under the next tap.
export function Chips<T extends string>({
  id,
  labelledBy,
  describedBy,
  note,
  options,
  selected,
  onToggle,
  quiet,
  single,
}: {
  id: string;
  labelledBy: string;
  describedBy?: string;
  note?: string;
  options: readonly Option<T>[];
  selected: readonly T[];
  onToggle: (value: T) => void;
  quiet?: T;
  single?: boolean;
}) {
  const any = options.some((option) => selected.includes(option.value));
  return (
    <div
      id={id}
      role={single ? "radiogroup" : "group"}
      aria-labelledby={labelledBy}
      aria-describedby={[describedBy, note].filter(Boolean).join(" ") || undefined}
      aria-invalid={describedBy ? true : undefined}
      className="flex flex-wrap gap-2.5"
    >
      {options.map((option, i) => {
        const on = selected.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            {...(single
              ? {
                  role: "radio",
                  "aria-checked": on,
                  tabIndex: on || (!any && i === 0) ? 0 : -1,
                  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) =>
                    arrows(event, i, options, onToggle),
                }
              : { "aria-pressed": on })}
            onClick={() => onToggle(option.value)}
            className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full py-2 text-left type-heading text-base tracking-tight transition-[background-color,color] duration-180 roomy:min-h-12 roomy:text-lg ${
              on
                ? "bg-diploma pr-4 pl-3 text-navy roomy:pr-5 roomy:pl-3.5"
                : `bg-diploma/13 px-6.75 hover:bg-diploma/19 hover:text-diploma active:bg-diploma/24 roomy:px-7.5 ${option.value === quiet ? "text-diploma/86" : "text-diploma"}`
            }`}
          >
            {on ? <Tick className="size-4.5 flex-none" /> : null}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Progress({
  at,
  from,
  total,
  disabled,
  back = "Previous question",
  label,
  onBack,
  bare,
}: {
  at: number;
  from: number;
  total: number;
  disabled?: boolean;
  back?: string;
  label?: string;
  onBack?: () => void;
  bare?: boolean;
}) {
  const fill = useRef<HTMLDivElement>(null);
  // The bar glides from where the last question left it.
  useLayoutEffect(() => {
    if (from === at || from < 1 || still()) return;
    fill.current?.animate(
      [{ transform: `scaleX(${from / total})` }, { transform: `scaleX(${at / total})` }],
      { duration: 300, easing: ENTER },
    );
  }, [at, from, total]);
  // Questions keep the back arrow's room even where there is none, so the bar stays put between them; a list never has
  // one, so its bar runs the column's width.
  return (
    <div
      data-progress
      className={`mb-5 flex h-12 items-center gap-3.5 roomy:mb-7 ${bare ? "" : "-ml-3.5"}`}
    >
      {bare ? null : (
        <button
          type="button"
          onClick={onBack}
          disabled={disabled}
          aria-label={back}
          className={`grid size-12 flex-none cursor-pointer place-items-center rounded-full text-diploma/86 transition-[background-color,color] hover:bg-diploma/13 hover:text-diploma disabled:cursor-wait disabled:text-diploma/45 disabled:hover:bg-transparent ${
            onBack ? "" : "invisible"
          }`}
        >
          <i aria-hidden className="ic back size-6" />
        </button>
      )}
      <div aria-hidden className="h-1 flex-1 overflow-hidden rounded-full bg-diploma/16">
        <div
          ref={fill}
          className="h-full origin-left rounded-full bg-burdell"
          style={{ transform: `scaleX(${at / total})` }}
        />
      </div>
      <p id="progress" className="sr-only">
        {label ?? `Question ${at} of ${total}`}
      </p>
    </div>
  );
}
