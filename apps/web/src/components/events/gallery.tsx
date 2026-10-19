import { type MouseEvent, type Ref, useLayoutEffect, useRef, useState } from "react";

import type { ClubEvent } from "./data";
import { Actions, monthOf, Picture, SHORT, tileShape } from "./detail";

const CAPTION_WIDTH = 136;

export function remeasure(els: Element | Iterable<Element>, measure: () => void) {
  measure();
  const watch = new ResizeObserver(measure);
  for (const el of els instanceof Element ? [els] : els) watch.observe(el);
  return () => watch.disconnect();
}

function Tile({
  event,
  w,
  h,
  next,
  on,
  tag,
  onPick,
}: {
  event: ClubEvent;
  w: number;
  h: number;
  next: boolean;
  on: boolean;
  tag: boolean;
  onPick: (id: string) => void;
}) {
  const href = `/hub?event=${encodeURIComponent(event.id)}`;
  const pick = (e: MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onPick(event.id);
  };
  return (
    <article className={on ? "t on" : "t"} style={{ width: w }} data-event={event.id}>
      <a
        className="pick"
        href={href}
        aria-label={event.title}
        aria-current={on || undefined}
        onClick={pick}
      >
        <Picture event={event} width={w} height={h} lazy>
          {tag ? <span className="nextup">Next up</span> : null}
        </Picture>
      </a>
      <div className="cap">
        <span className="meta">
          {next ? <em>{SHORT.format(event.startsAt)}</em> : SHORT.format(event.startsAt)}
        </span>
        <a className="ct" href={href} tabIndex={-1} aria-hidden onClick={pick}>
          {event.title}
        </a>
        <Actions event={event} mode="tile" />
      </div>
    </article>
  );
}

const BARS = [
  [58, 82, 48],
  [46, 70, 56],
  [64, 88, 40],
] as const;

function Blank({ shape, h, k, fade = 1 }: { shape: number; h: number; k: number; fade?: number }) {
  const [meta, line, rest] = BARS[k % BARS.length]!;
  return (
    <div className="t sk" style={{ width: shape * h, opacity: fade }}>
      <span className="skp" style={{ height: h }} />
      <div className="cap">
        <span className="meta">
          <i style={{ width: `${meta}%` }} />
        </span>
        <span className="ct">
          <i style={{ width: `${line}%` }} />
          <i style={{ width: `${rest}%` }} />
        </span>
        <span className="ra" />
      </div>
    </div>
  );
}

type Grid = { width: number; gap: number; row: number; phone: boolean };

export function Skeletons({ box, ...grid }: Grid & { box: Ref<HTMLDivElement> }) {
  const month = (shapes: number[], k0: number) => (
    <section className="mon">
      <div className="mh">
        <span className="skm" />
      </div>
      <div className={grid.phone ? "strip still" : "wall"}>
        {shapes.map((shape, k) => (
          <Blank key={k} shape={shape} h={grid.row} k={k0 + k} />
        ))}
      </div>
    </section>
  );
  return (
    <div ref={box} className="skel" aria-hidden>
      {month([0.8, 1, 1.78], 0)}
      {month([0.75, 1.78, 0.8, 1], 3)}
    </div>
  );
}

const FILL = [1, 1.78, 0.8, 0.75, 1, 0.8];

export function Gallery({
  events,
  now,
  next,
  selected,
  onPick,
  ...grid
}: Grid & {
  events: ClubEvent[];
  now: number;
  next?: ClubEvent;
  selected?: ClubEvent;
  onPick: (id: string) => void;
}) {
  const captionRuler = useRef<HTMLDivElement>(null);
  const [captionWidths, setCaptionWidths] = useState<Record<string, number>>({});
  useLayoutEffect(() => {
    const box = captionRuler.current!;
    return remeasure(box.children, () => {
      const next = Object.fromEntries(
        events.map((e, i) => [e.id, Math.ceil(box.children[i]!.getBoundingClientRect().width)]),
      );
      setCaptionWidths((old) => (events.every((e) => old[e.id] === next[e.id]) ? old : next));
    });
  }, [events]);
  const { width, gap, row, phone } = grid;
  const wide = (e: ClubEvent) =>
    Math.min(width, Math.max(captionWidths[e.id] ?? CAPTION_WIDTH, row * tileShape(e)));

  const tile = (e: ClubEvent) => (
    <Tile
      key={e.id}
      event={e}
      w={wide(e)}
      h={row}
      next={e === next}
      on={e === selected}
      tag={!selected && e === next}
      onPick={onPick}
    />
  );
  const months: [string, ClubEvent[]][] = [];
  for (const e of events) {
    const label = monthOf(e.startsAt, now);
    if (months.at(-1)?.[0] === label) months.at(-1)![1].push(e);
    else months.push([label, [e]]);
  }

  const lone = (e: ClubEvent) => {
    if (phone)
      return (
        <div className="strip still">
          {tile(e)}
          <Blank shape={0.8} h={row} k={1} fade={0.7} />
          <Blank shape={1} h={row} k={2} fade={0.4} />
        </div>
      );
    let room = width - wide(e);
    const fill: number[] = [];
    for (const shape of FILL) {
      if (room < gap + shape * row) break;
      room -= gap + shape * row;
      fill.push(shape);
    }
    return (
      <div className="wall">
        {tile(e)}
        {fill.map((shape, k) => (
          <Blank
            key={k}
            shape={shape}
            h={row}
            k={k + 1}
            fade={0.8 - (0.55 * k) / Math.max(1, fill.length - 1)}
          />
        ))}
      </div>
    );
  };

  return (
    <>
      <div ref={captionRuler} className="caps">
        {events.map((e) => (
          <div key={e.id} className="cap">
            <span className="meta">{SHORT.format(e.startsAt)}</span>
            <span className="acts">
              {e.link ? <span className="ra" /> : null}
              <span className="ra" />
            </span>
          </div>
        ))}
      </div>
      {months.map(([label, list]) => (
        <section key={label} className="mon">
          <div className="mh">
            <h2 className="mo">{label}</h2>
            <span className="n">
              {list.length} {list.length === 1 ? "event" : "events"}
            </span>
          </div>
          {events.length === 1 ? (
            lone(list[0]!)
          ) : (
            <div className={phone ? "strip" : "wall"}>{list.map(tile)}</div>
          )}
        </section>
      ))}
    </>
  );
}
