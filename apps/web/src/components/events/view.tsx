import { useRouterState } from "@tanstack/react-router";
import {
  type RefObject,
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { APPEAR, MOVE, playAfterFirstFrame, still } from "@/lib/motion";

import { type ClubEvent, isPast } from "./data";
import { Actions, Details, type Fit, fitStack, Picture, stackShape, STICKER } from "./detail";
import { remeasure } from "./gallery";

function flight(r0: DOMRect, r: DOMRect, round: number): Keyframe {
  const x = r.left - r0.left;
  const y = r.top - r0.top;
  const sx = r.width / r0.width;
  const s = r.height / r0.height;
  if (Math.abs(sx / s - 1) < 0.01)
    return {
      transform: `translate(${x}px, ${y}px) scale(${sx}, ${s})`,
      borderRadius: `${round / s}px`,
    };
  const side = (r0.width * s - r.width) / 2;
  return {
    transform: `translate(${x - side}px, ${y}px) scale(${s})`,
    clipPath: `inset(0 ${side / s}px round ${round / s}px)`,
  };
}

const NO_CLIP = "inset(0 0 round 0px)";
function clipBothEnds(a: Keyframe, b: Keyframe) {
  if (!a.clipPath !== !b.clipPath) (a.clipPath ? b : a).clipPath = NO_CLIP;
  return [a, b];
}
const radius = (el: Element) => parseFloat(getComputedStyle(el).borderTopLeftRadius);
const DRAG_START = 8;
export const tileOf = (id: string) =>
  document.querySelector<HTMLElement>(`.gal [data-event="${CSS.escape(id)}"]`);
function coverTile(pic: HTMLElement) {
  pic.style.visibility = "hidden";
  return () => pic.style.removeProperty("visibility");
}
// iPhone Safari leaves the details' text opaque under an opacity animation, so they and the flier's buttons go at
// once and only the flier flies.
function hideDetails(inner: HTMLElement) {
  const parts = inner.querySelectorAll<HTMLElement>(".det, .cor");
  for (const el of parts) el.style.visibility = "hidden";
  return () => {
    for (const el of parts) el.style.removeProperty("visibility");
  };
}
function fadeWash(pic: Element, tile: Element, into: boolean, options: KeyframeAnimationOptions) {
  if (!pic.querySelector(".wash")) return [];
  return [".wash", "img"].flatMap((part) => {
    const el = pic.querySelector(part);
    const worn = tile.querySelector(part);
    if (!el || !worn) return [];
    const onTile = getComputedStyle(worn).opacity;
    const atRest = part === "img" ? "1" : "0";
    const current = getComputedStyle(el).opacity;
    el.getAnimations().forEach((a) => a.cancel());
    const frames = into
      ? [{ opacity: current }, { opacity: onTile }]
      : [{ opacity: onTile }, { opacity: atRest }];
    return [el.animate(frames, options)];
  });
}
function takeOver(el: HTMLElement) {
  const y = new DOMMatrix(getComputedStyle(el).transform).m42;
  el.getAnimations().forEach((a) => a.cancel());
  return y;
}

export function View({
  events: list,
  shapes,
  start,
  now,
  next,
  probe,
  grow,
  stayOpen,
  onPage,
  onClose,
  onGone,
}: {
  events: ClubEvent[];
  shapes: number[];
  start: number;
  now: number;
  next?: ClubEvent;
  probe: RefObject<HTMLDivElement | null>;
  grow: RefObject<boolean>;
  stayOpen: boolean;
  onPage: (id: string) => void;
  onClose: () => void;
  onGone: (id: string) => void;
}) {
  // Every position in here is an index, so the list holds still for as long as the viewer is open.
  const [events] = useState(list);
  const routerIdle = useRouterState({ select: (s) => s.status === "idle" });
  const dialog = useRef<HTMLDialogElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const ruler = useRef<HTMLDivElement>(null);
  const reel = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<Fit | null>(null);
  const [initial] = useState(start);
  const [at, setAt] = useState(start);
  const [resting, setResting] = useState(start);
  const here = useRef(start);
  const leaving = useRef(false);
  const focusWasOnOldPage = useRef(false);
  // The router restores scroll by element when the dialog closes, so each dialog names its scrollers afresh rather
  // than take an earlier dialog's positions.
  const scrollId = useId();

  useLayoutEffect(() => {
    const d = dialog.current!;
    d.showModal();
    d.focus();
    return () => d.close();
  }, []);

  useLayoutEffect(() => {
    const measure = () => {
      const page = track.current!.firstElementChild as HTMLElement;
      const cs = getComputedStyle(page);
      const room = page.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      const next = fitStack(probe.current!, shapes, ruler.current!.clientWidth, room);
      setFit((f) => (f?.width === next.width && f.t === next.t ? f : next));
    };
    const stop = remeasure(probe.current!, measure);
    addEventListener("resize", measure);
    return () => {
      stop();
      removeEventListener("resize", measure);
    };
  }, [shapes, probe]);

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

  useLayoutEffect(() => {
    if (!fit) return;
    const t = track.current!;
    t.scrollLeft = here.current * t.clientWidth;
  }, [fit]);

  useLayoutEffect(() => {
    Array.from(track.current!.children).forEach((page, k) => {
      if (k !== resting) page.scrollTop = 0;
    });
  }, [resting]);

  const open = useEffectEvent(() => {
    centre(initial, false);
    if (!grow.current) return;
    const d = dialog.current!;
    if (still())
      return void d.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120, easing: APPEAR });
    const page = track.current!.children[initial] as HTMLElement;
    const p = page.querySelector<HTMLElement>(".pic")!;
    const from = tileOf(events[initial]!.id)?.querySelector<HTMLElement>(".pic");
    const backdrop = { duration: 280, easing: APPEAR };
    const all = [
      d.querySelector(".bg")!.animate([{ opacity: 0 }, { opacity: 1 }], backdrop),
      d.animate([{ opacity: 0 }, { opacity: 1 }], { ...backdrop, pseudoElement: "::after" }),
      ...(
        [
          [page.querySelector(".det"), 120],
          [page.querySelector(".cor"), 160],
          [d.querySelector(".ctl"), 200],
        ] as const
      ).flatMap(([el, delay]) =>
        el
          ? el.animate(
              [
                { opacity: 0, transform: "translateY(12px)" },
                { opacity: 1, transform: "none" },
              ],
              { duration: 300, delay, easing: MOVE, fill: "backwards" },
            )
          : [],
      ),
    ];
    let uncover = () => {};
    if (from) {
      all.push(...fadeWash(p, from, false, { duration: 420, easing: MOVE }));
      const rest = { transform: "none", borderRadius: `${radius(p)}px` };
      const flying = p.animate(
        clipBothEnds(
          flight(p.getBoundingClientRect(), from.getBoundingClientRect(), radius(from)),
          rest,
        ),
        { duration: 420, easing: MOVE },
      );
      all.push(flying);
      const show = () => {
        if (!leaving.current || here.current !== initial) uncover();
      };
      void flying.finished.then(show, show);
    }
    playAfterFirstFrame(all, () => {
      if (leaving.current) return false;
      if (from) uncover = coverTile(from);
      return true;
    });
  });
  const fitted = fit !== null;
  useLayoutEffect(() => {
    if (fitted) open();
  }, [fitted]);

  useEffect(() => centre(at, true), [at]);

  useLayoutEffect(() => {
    if (!focusWasOnOldPage.current) return;
    focusWasOnOldPage.current = false;
    track.current?.children[at]?.querySelector<HTMLElement>(".ttl")?.focus({ preventScroll: true });
  }, [at]);

  const go = (k: number, smooth = true) => {
    const t = track.current!;
    const to = Math.max(0, Math.min(events.length - 1, k));
    const near = Math.abs(to - here.current) <= 1;
    t.scrollTo({
      left: to * t.clientWidth,
      behavior: smooth && near && !still() ? "smooth" : "auto",
    });
  };

  function onScroll() {
    const t = track.current!;
    const k = Math.round(t.scrollLeft / t.clientWidth);
    if (Math.abs(t.scrollLeft - k * t.clientWidth) < 1) setResting(k);
    if (k === here.current || leaving.current || !events[k]) return;
    dialog.current?.querySelector<HTMLElement>(":popover-open")?.hidePopover();
    const focus = document.activeElement;
    focusWasOnOldPage.current =
      focus === dialog.current || !!t.children[here.current]?.contains(focus);
    here.current = k;
    setAt(k);
    onPage(events[k].id);
  }

  function close() {
    if (leaving.current) return;
    leaving.current = true;
    dialog.current?.querySelector<HTMLElement>(":popover-open")?.hidePopover();
    onClose();
  }

  const flyBack = useEffectEvent(() => {
    leaving.current = true;
    dialog.current?.querySelector<HTMLElement>(":popover-open")?.hidePopover();
    const k = here.current;
    const event = events[k]!;
    const tile = tileOf(event.id);
    tile?.scrollIntoView({ block: "nearest", inline: "nearest" });
    const slot = tile?.querySelector<HTMLElement>(".pic");
    let uncover = () => {};
    const done = () => {
      uncover();
      onGone(event.id);
    };
    const d = dialog.current!;
    if (still())
      return void d
        .animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: 120,
          easing: APPEAR,
          fill: "forwards",
        })
        .finished.then(done, done);
    const inner = (track.current!.children[k] as HTMLElement).firstElementChild as HTMLElement;
    const p = inner.querySelector<HTMLElement>(".pic")!;
    const bg = d.querySelector<HTMLElement>(".bg")!;
    const was = p.getBoundingClientRect();
    for (const el of [p, inner]) el.getAnimations().forEach((a) => a.cancel());
    const fade = parseFloat(getComputedStyle(bg).opacity);
    hideDetails(inner);
    inner.style.transform = "";
    const r0 = p.getBoundingClientRect();
    const backdrop = { duration: 300, easing: MOVE, fill: "forwards" } as const;
    bg.animate([{ opacity: fade }, { opacity: 0 }], backdrop);
    d.animate([{ opacity: getComputedStyle(d, "::after").opacity }, { opacity: 0 }], {
      ...backdrop,
      pseudoElement: "::after",
    });
    const ctl = d.querySelector<HTMLElement>(".ctl")!;
    ctl.animate([{ opacity: parseFloat(getComputedStyle(ctl).opacity) }, { opacity: 0 }], {
      duration: 140,
      easing: APPEAR,
      fill: "forwards",
    });
    if (slot) {
      uncover = coverTile(slot);
      fadeWash(p, slot, true, { duration: 340, easing: MOVE, fill: "forwards" });
    }
    const flying = slot
      ? p.animate(
          clipBothEnds(
            flight(r0, was, radius(p) * (was.height / r0.height)),
            flight(r0, slot.getBoundingClientRect(), radius(slot)),
          ),
          { duration: 340, easing: MOVE, fill: "forwards" },
        )
      : d.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: 200,
          easing: APPEAR,
          fill: "forwards",
        });
    void flying.finished.then(done, done);
  });
  const leave = !stayOpen && routerIdle;
  useEffect(() => {
    if (leave) flyBack();
  }, [leave]);

  const pulled = useEffectEvent(close);
  useEffect(() => {
    const t = track.current!;
    const d = dialog.current!;
    const bg = d.querySelector<HTMLElement>(".bg")!;
    const ctl = d.querySelector<HTMLElement>(".ctl")!;
    const page = () => t.children[here.current] as HTMLElement;
    const inner = () => page().firstElementChild as HTMLElement;
    let showDetails = () => {};
    let y0: number | null = null;
    let x0 = 0;
    let dy = 0;
    let pulling = false;
    let last = { dy: 0, at: 0 };
    let before = last;
    const begin = (e: TouchEvent) => {
      if (pulling) return;
      if (e.touches.length > 1) return void (y0 = null);
      x0 = e.touches[0]!.clientX;
      y0 = e.touches[0]!.clientY;
      dy = 0;
    };
    const move = (e: TouchEvent) => {
      if (y0 === null) return;
      const { clientX, clientY } = e.touches[0]!;
      if (!pulling) {
        const down = clientY - y0;
        const side = clientX - x0;
        if (Math.abs(side) < DRAG_START && Math.abs(down) < DRAG_START) return;
        if (Math.abs(side) > Math.abs(down) || down < 0 || page().scrollTop > 0)
          return void (y0 = null);
        pulling = true;
        const el = inner();
        y0 -= takeOver(el);
        for (const x of [bg, ctl]) x.getAnimations().forEach((a) => a.cancel());
        showDetails = hideDetails(el);
        last = { dy: clientY - y0, at: performance.now() };
        before = last;
      }
      if (e.cancelable) e.preventDefault();
      dy = Math.max(0, clientY - y0);
      const at = performance.now();
      if (at - last.at >= 16) before = last;
      last = { dy, at };
      inner().style.transform = `translateY(${dy}px) scale(${1 - Math.min(dy / 1100, 0.25)})`;
      bg.style.opacity = String(Math.max(0, 1 - dy / 320));
      ctl.style.opacity = String(Math.max(0, 1 - dy / 120));
    };
    const end = (e: TouchEvent) => {
      if (e.touches.length || y0 === null) return;
      y0 = null;
      if (!pulling) return;
      pulling = false;
      const speed = (last.dy - before.dy) / Math.max(1, performance.now() - before.at);
      if (dy > 110 || speed > 0.11) return pulled();
      const el = inner();
      const from = el.style.transform;
      el.style.transform = "";
      if (!still())
        el.animate([{ transform: from }, { transform: "none" }], { duration: 260, easing: MOVE });
      for (const x of [bg, ctl]) {
        x.animate([{ opacity: x.style.opacity }, { opacity: 1 }], { duration: 260, easing: MOVE });
        x.style.opacity = "";
      }
      showDetails();
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
      aria-label={events[0] && isPast(events[0], now) ? "Past events" : "Upcoming events"}
      tabIndex={-1}
      style={fit ? { "--w": `${fit.width}px`, "--t": fit.t } : undefined}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onKeyDown={(e) => {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        e.preventDefault();
        go(here.current + (e.key === "ArrowRight" ? 1 : -1), false);
      }}
    >
      <div className="bg" />
      <div ref={ruler} className="ruler" />
      <div
        ref={track}
        className="slide"
        data-scroll-restoration-id={`${scrollId}track`}
        onScroll={onScroll}
      >
        {events.map((e, k) => (
          <section
            key={e.id}
            className="pg"
            data-scroll-restoration-id={`${scrollId}${k}`}
            aria-label={e.title}
            inert={k !== at}
          >
            <div className="pg-in stk">
              {fit ? (
                <>
                  <Picture
                    event={e}
                    width={fit.width}
                    height={fit.width / stackShape(e)}
                    lazy={Math.abs(k - at) > 1}
                    past={isPast(e, now)}
                  >
                    <Actions event={e} mode="corner" now={now} />
                  </Picture>
                  <Details
                    event={e}
                    now={now}
                    next={e === next}
                    eyebrow
                    offScreen={k !== resting}
                  />
                </>
              ) : null}
            </div>
          </section>
        ))}
      </div>
      <div className="ctl">
        <button type="button" className="cl" aria-label="Back to the gallery" onClick={close}>
          <i className="ic x" aria-hidden />
        </button>
        {events.length > 1 ? (
          <>
            <span className="sep" aria-hidden />
            <div
              ref={reel}
              className="reel"
              data-scroll-restoration-id={`${scrollId}reel`}
              onScroll={edges}
            >
              {events.map((e, k) => (
                <button
                  key={e.id}
                  type="button"
                  aria-current={k === at || undefined}
                  aria-label={e.title}
                  onClick={() => go(k)}
                >
                  <span className="th">
                    {e.flier ? (
                      <img src={e.flier.src} loading="lazy" alt="" />
                    ) : (
                      <img className="st" src={STICKER} alt="" />
                    )}
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : null}
      </div>
      <p className="sr-only" role="status" />
    </dialog>
  );
}
