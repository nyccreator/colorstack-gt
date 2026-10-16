import type { MouseEvent, Ref } from "react";

import type { ClubEvent } from "./data";
import { Add, monthOf, Picture, SHORT, tileShape } from "./detail";

// Rows of one height that fill the width, within one month: a least-squares partition around the target height. A
// month's last row that can't fill keeps the target height and ends where its fliers end. No tile gets narrower than
// its caption's date and Add button.
const NARROWEST = 136;

function justify<X>(
  items: X[],
  shape: (x: X) => number,
  width: number,
  gap: number,
  target: number,
) {
  const n = items.length;
  const lo = 0.72 * target;
  const hi = 1.32 * target;
  const best = [0];
  const from = [0];
  for (let i = 1; i <= n; i++) {
    best[i] = Infinity;
    let sum = 0;
    let narrow = Infinity;
    for (let j = i - 1; j >= 0; j--) {
      sum += shape(items[j]!);
      narrow = Math.min(narrow, shape(items[j]!));
      const k = i - j;
      const h = (width - (k - 1) * gap) / sum;
      if ((h < lo || h * narrow < NARROWEST) && k > 1) break;
      const cost = h > hi ? (i === n ? 0.4 : 9) : ((h - target) / target) ** 2;
      if (best[j]! + cost < best[i]!) {
        best[i] = best[j]! + cost;
        from[i] = j;
      }
    }
  }
  const rows: X[][] = [];
  for (let i = n; i > 0; i = from[i]!) rows.unshift(items.slice(from[i], i));
  return rows.map((row) => {
    const h = (width - (row.length - 1) * gap) / row.reduce((s, x) => s + shape(x), 0);
    return { items: row, h: h > hi ? target : h };
  });
}

function Tile({
  event,
  h,
  next,
  on,
  tag,
  onPick,
}: {
  event: ClubEvent;
  h: number;
  next: boolean;
  on: boolean;
  tag: boolean;
  onPick: (id: string) => void;
}) {
  const w = tileShape(event) * h;
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
        <Picture event={event} width={w} height={h}>
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
        <Add event={event} tile />
      </div>
    </article>
  );
}

const BARS = [
  [58, 82, 48],
  [46, 70, 56],
  [64, 88, 40],
] as const;

// A skeleton flier with its caption, as faint shapes.
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

type Grid = { width: number; gap: number; target: number; phone: boolean };

// Skeleton months hold the gallery's shape when there's little or nothing in it. They don't shimmer, since nothing is
// loading, and they fade out, so they never read as events.
export function Skeletons({ box, ...grid }: Grid & { box: Ref<HTMLDivElement> }) {
  const month = (shapes: number[], k0: number) => (
    <section className="mon">
      <div className="mh">
        <span className="skm" />
      </div>
      {grid.phone ? (
        <div className="strip still">
          {shapes.map((shape, k) => (
            <Blank key={k} shape={shape} h={grid.target} k={k0 + k} />
          ))}
        </div>
      ) : (
        <div className="wall">
          {justify(shapes, (s) => s, grid.width, grid.gap, grid.target).map((row, r) => (
            <div key={r} className="line">
              {row.items.map((shape, k) => (
                <Blank key={k} shape={shape} h={row.h} k={k0 + k} />
              ))}
            </div>
          ))}
        </div>
      )}
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
  const tile = (e: ClubEvent, h: number) => (
    <Tile
      key={e.id}
      event={e}
      h={h}
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
  const { width, gap, target, phone } = grid;

  // A single event leads its month's row, and skeletons fill the rest of it: as many as bring the row nearest its
  // usual height.
  const lone = (e: ClubEvent) => {
    if (phone)
      return (
        <div className="strip still">
          {tile(e, target)}
          <Blank shape={0.8} h={target} k={1} fade={0.7} />
          <Blank shape={1} h={target} k={2} fade={0.4} />
        </div>
      );
    const fill = (n: number) =>
      (width - n * gap) / FILL.slice(0, n).reduce((s, a) => s + a, tileShape(e));
    let n = 1;
    for (let k = 2; k <= FILL.length; k++)
      if (Math.abs(fill(k) - target) < Math.abs(fill(n) - target)) n = k;
    const h = fill(n);
    return (
      <div className="wall">
        <div className="line">
          {tile(e, h)}
          {FILL.slice(0, n).map((shape, k) => (
            <Blank
              key={k}
              shape={shape}
              h={h}
              k={k + 1}
              fade={0.8 - (0.55 * k) / Math.max(1, n - 1)}
            />
          ))}
        </div>
      </div>
    );
  };

  return months.map(([label, list]) => (
    <section key={label} className="mon">
      <div className="mh">
        <h2 className="mo">{label}</h2>
        <span className="n">
          {list.length} {list.length === 1 ? "event" : "events"}
        </span>
      </div>
      {events.length === 1 ? (
        lone(list[0]!)
      ) : phone ? (
        <div className="strip">{list.map((e) => tile(e, target))}</div>
      ) : (
        <div className="wall">
          {justify(list, tileShape, width, gap, target).map((row) => (
            <div key={row.items[0]!.id} className="line">
              {row.items.map((e) => tile(e, row.h))}
            </div>
          ))}
        </div>
      )}
    </section>
  ));
}
