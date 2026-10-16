import {
  type CSSProperties,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { MOVE, still } from "@/lib/motion";

import type { ClubEvent } from "./data";
import { Details, type Fit, fitStack, Picture, stackShape, Zoom } from "./detail";

const home = { transform: "none", clipPath: "inset(0 0 round 0px)" };

// The transform that draws an element laid out at r0 over the rect r. A flier keeps its shape all the way; a sticker's
// box changes shape between tile and page, so it scales evenly and its sides are clipped to the tile instead.
function flight(r0: DOMRect, r: DOMRect, even: boolean) {
  const x = r.left - r0.left;
  const y = r.top - r0.top;
  if (!even)
    return {
      transform: `translate(${x}px, ${y}px) scale(${r.width / r0.width}, ${r.height / r0.height})`,
      clipPath: home.clipPath,
    };
  const s = r.height / r0.height;
  const side = (r0.width * s - r.width) / 2;
  return {
    transform: `translate(${x - side}px, ${y}px) scale(${s})`,
    clipPath: `inset(0 ${side / s}px round ${16 / s}px)`,
  };
}
const tileOf = (id: string) =>
  document.querySelector<HTMLElement>(`.gal [data-event="${CSS.escape(id)}"]`);

// Phones and tablets: a picked event grows out of its flier over the page, one event a page. Sideways moves between
// events, and down returns to the gallery as the flier flies back into its place, however the member leaves. The × and
// every event's flier sit in one bar where the Events and You switch was.
export function View({
  events,
  start,
  now,
  next,
  probe,
  grow,
  away,
  onPage,
  onClose,
  onGone,
}: {
  events: ClubEvent[];
  start: number;
  now: number;
  next?: ClubEvent;
  probe: RefObject<HTMLDivElement | null>;
  grow: boolean;
  away: boolean;
  onPage: (id: string) => void;
  onClose: (id: string) => void;
  onGone: (id: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const ruler = useRef<HTMLDivElement>(null);
  const reel = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<Fit | null>(null);
  const [at, setAt] = useState(start);
  const here = useRef(start);
  const shown = useRef(false);
  const leaving = useRef(false);

  useLayoutEffect(() => {
    const d = dialog.current!;
    d.showModal();
    d.focus();
    const measure = () => {
      const page = track.current!.firstElementChild as HTMLElement;
      const cs = getComputedStyle(page);
      const room = page.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      setFit(fitStack(probe.current!, events.map(stackShape), ruler.current!.clientWidth, room));
    };
    measure();
    addEventListener("resize", measure);
    return () => {
      removeEventListener("resize", measure);
      d.close();
    };
  }, []);

  // The strip of fliers fades at an edge that has more beyond it.
  const edges = () => {
    const r = reel.current;
    if (!r) return;
    r.toggleAttribute("data-before", r.scrollLeft > 1);
    r.toggleAttribute("data-after", r.scrollLeft + r.clientWidth < r.scrollWidth - 1);
  };
  const centre = (k: number, smooth: boolean) => {
    const r = reel.current;
    const b = r?.children[k] as HTMLElement | undefined;
    if (!r || !b) return;
    r.scrollTo({
      left: b.offsetLeft - (r.clientWidth - b.offsetWidth) / 2,
      behavior: smooth && !still() ? "smooth" : "auto",
    });
    edges();
  };

  // The tapped event's flier starts where its tile sits in the gallery; the rest fades up around it.
  useLayoutEffect(() => {
    const t = track.current!;
    if (!fit) return;
    t.scrollLeft = here.current * t.clientWidth;
    if (shown.current) return;
    shown.current = true;
    centre(start, false);
    if (!grow || still()) return;
    const d = dialog.current!;
    const page = t.children[start] as HTMLElement;
    const p = page.querySelector<HTMLElement>(".pic")!;
    const from = tileOf(events[start]!.id)?.querySelector(".pic");
    d.querySelector(".bg")!.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 280,
      easing: "ease-out",
    });
    for (const el of [d.querySelector(".ctl")!, page.querySelector(".det")!])
      el.animate(
        [
          { opacity: 0, translate: "0 12px" },
          { opacity: 1, translate: "0 0" },
        ],
        {
          duration: 300,
          delay: 120,
          easing: MOVE,
          fill: "backwards",
          composite: "add",
        },
      );
    if (from)
      p.animate(
        [
          flight(p.getBoundingClientRect(), from.getBoundingClientRect(), !events[start]!.flier),
          home,
        ],
        { duration: 420, easing: MOVE },
      );
  }, [fit]);

  useEffect(() => centre(at, true), [at]);

  // Back in the browser takes the event away too, and it leaves the same way.
  useEffect(() => {
    if (away) close(true);
  }, [away]);

  const go = (k: number) => {
    const t = track.current!;
    const to = Math.max(0, Math.min(events.length - 1, k));
    t.scrollTo({ left: to * t.clientWidth, behavior: still() ? "auto" : "smooth" });
  };

  function onScroll() {
    const t = track.current!;
    const k = Math.round(t.scrollLeft / t.clientWidth);
    if (k === here.current || leaving.current || !events[k]) return;
    here.current = k;
    setAt(k);
    onPage(events[k].id);
  }

  // The event looked at last comes into view in the gallery behind, then its flier flies back to it.
  function close(gone = false) {
    if (leaving.current) return;
    leaving.current = true;
    const k = here.current;
    const event = events[k]!;
    const tile = tileOf(event.id);
    tile?.scrollIntoView({ block: "nearest", inline: "nearest" });
    const done = () => {
      if (!gone) onClose(event.id);
      onGone(event.id);
    };
    if (still()) return done();
    const d = dialog.current!;
    const inner = (track.current!.children[k] as HTMLElement).firstElementChild as HTMLElement;
    const p = inner.querySelector<HTMLElement>(".pic")!;
    const bg = d.querySelector<HTMLElement>(".bg")!;
    const was = p.getBoundingClientRect();
    const fade = parseFloat(getComputedStyle(bg).opacity);
    inner.style.transform = "";
    const r0 = p.getBoundingClientRect();
    const to = tile?.querySelector(".pic")?.getBoundingClientRect();
    bg.animate([{ opacity: fade }, { opacity: 0 }], {
      duration: 300,
      easing: "ease-in",
      fill: "forwards",
    });
    for (const el of [
      d.querySelector<HTMLElement>(".ctl")!,
      inner.querySelector<HTMLElement>(".det")!,
    ])
      el.animate([{ opacity: parseFloat(getComputedStyle(el).opacity) }, { opacity: 0 }], {
        duration: 140,
        fill: "forwards",
      });
    const flying = to
      ? p.animate([flight(r0, was, false), flight(r0, to, !event.flier)], {
          duration: 340,
          easing: MOVE,
          fill: "forwards",
        })
      : d.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: "forwards" });
    void flying.finished.then(done, done);
  }

  // Pulling down from a page at its top closes: the event shrinks a little as it follows the finger, with the gallery
  // showing through. A short pull springs back. Sideways stays the track's.
  useEffect(() => {
    const t = track.current!;
    const d = dialog.current!;
    const bg = d.querySelector<HTMLElement>(".bg")!;
    const ctl = d.querySelector<HTMLElement>(".ctl")!;
    const page = () => t.children[here.current] as HTMLElement;
    const inner = () => page().firstElementChild as HTMLElement;
    let y0: number | null = null;
    let x0 = 0;
    let t0 = 0;
    let dy = 0;
    let pulling = false;
    const begin = (e: TouchEvent) => {
      x0 = e.touches[0]!.clientX;
      y0 = e.touches[0]!.clientY;
      t0 = performance.now();
      dy = 0;
      pulling = false;
    };
    const move = (e: TouchEvent) => {
      if (y0 === null) return;
      const down = e.touches[0]!.clientY - y0;
      const side = e.touches[0]!.clientX - x0;
      if (!pulling) {
        if (Math.abs(side) > Math.abs(down)) return void (y0 = null);
        if (down > 0 && page().scrollTop <= 0) pulling = true;
        else {
          if (Math.abs(down) > 6) y0 = null;
          return;
        }
      }
      if (e.cancelable) e.preventDefault();
      dy = Math.max(0, down);
      inner().style.transform = `translateY(${dy}px) scale(${1 - Math.min(dy / 1100, 0.25)})`;
      bg.style.opacity = String(Math.max(0, 1 - dy / 320));
      ctl.style.opacity = String(Math.max(0, 1 - dy / 120));
    };
    const end = () => {
      if (y0 === null) return;
      y0 = null;
      if (!pulling) return;
      if (dy > 110 || dy / Math.max(1, performance.now() - t0) > 0.6) return close();
      const el = inner();
      const from = el.style.transform;
      el.style.transform = "";
      el.animate([{ transform: from }, { transform: "none" }], { duration: 260, easing: MOVE });
      bg.style.opacity = "";
      ctl.style.opacity = "";
    };
    t.addEventListener("touchstart", begin, { passive: true });
    t.addEventListener("touchmove", move, { passive: false });
    t.addEventListener("touchend", end);
    t.addEventListener("touchcancel", end);
    return () => {
      t.removeEventListener("touchstart", begin);
      t.removeEventListener("touchmove", move);
      t.removeEventListener("touchend", end);
      t.removeEventListener("touchcancel", end);
    };
  }, []);

  return (
    <dialog
      ref={dialog}
      className="view"
      aria-label="Upcoming events"
      tabIndex={-1}
      style={fit ? ({ "--w": `${fit.width}px`, "--t": fit.t } as CSSProperties) : undefined}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onKeyDown={(e) => {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        e.preventDefault();
        go(here.current + (e.key === "ArrowRight" ? 1 : -1));
      }}
    >
      <div className="bg" />
      <div ref={ruler} className="ruler" />
      <div ref={track} className="slide" onScroll={onScroll}>
        {events.map((e, k) => (
          <section key={e.id} className="pg" aria-label={e.title} inert={k !== at}>
            <div className="pg-in stk">
              {fit ? (
                <>
                  <Picture event={e} width={fit.width} height={fit.width / stackShape(e)}>
                    <Zoom event={e} />
                  </Picture>
                  <Details
                    event={e}
                    now={now}
                    next={e === next}
                    eyebrow
                    narrow={fit.width / fit.t < 300}
                  />
                </>
              ) : null}
            </div>
          </section>
        ))}
      </div>
      <div className="ctl">
        <button
          type="button"
          className="cl"
          aria-label="Back to the gallery"
          onClick={() => close()}
        >
          <i className="ic x" aria-hidden />
        </button>
        {events.length > 1 ? (
          <>
            <span className="sep" aria-hidden />
            <div ref={reel} className="reel" onScroll={edges}>
              {events.map((e, k) => (
                <button
                  key={e.id}
                  type="button"
                  aria-current={k === at || undefined}
                  aria-label={e.title}
                  data-tone={e.flier ? undefined : e.tone}
                  onClick={() => go(k)}
                >
                  <span className="th">
                    {e.flier ? (
                      <img src={e.flier.src} alt="" />
                    ) : (
                      <img className="st" src={`/assets/art/stickers/${e.art}.svg`} alt="" />
                    )}
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </dialog>
  );
}
