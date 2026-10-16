import { useNavigate, useRouter } from "@tanstack/react-router";
import {
  type CSSProperties,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { Bar, Pages } from "../frame";
import { EVENTS } from "./data";
import { away, Details, type Fit, fitStack, Nothing, Picture, stackShape, Zoom } from "./detail";
import { Gallery, Skeletons } from "./gallery";
import { View } from "./view";

// Laptops tall enough for the pinned bar get the selected event beside the gallery; everything else opens events over
// the page. The You page pins its bar at the same size.
const DESK = "(min-width: 1024px) and (min-height: 560px)";
const PHONE = "(max-width: 599px)";
const NONE = { art: "event", tone: "navy-medium" } as const;

const useMedia = (query: string) =>
  useSyncExternalStore(
    (listener) => {
      const list = matchMedia(query);
      list.addEventListener("change", listener);
      return () => list.removeEventListener("change", listener);
    },
    () => matchMedia(query).matches,
    () => false,
  );

function useViewport() {
  const [size, setSize] = useState(() => ({ w: innerWidth, h: innerHeight }));
  useEffect(() => {
    const resize = () => setSize({ w: innerWidth, h: innerHeight });
    addEventListener("resize", resize);
    return () => removeEventListener("resize", resize);
  }, []);
  return size;
}

// The laptop's column of the selected event, and the same column for an empty calendar on tablets.
const column = (w: number) => Math.max(300, Math.min(330, 0.22 * w));
const columnGap = (w: number) => Math.max(40, Math.min(64, 0.045 * w));

export function EventsPage({ picked }: { picked?: string }) {
  const navigate = useNavigate();
  const router = useRouter();
  const desk = useMedia(DESK);
  const phone = useMedia(PHONE);
  const viewport = useViewport();
  const [now] = useState(Date.now);
  const upcoming = useMemo(
    () => EVENTS.filter((e) => e.endsAt > now).sort((a, b) => a.startsAt - b.startsAt),
    [now],
  );
  const next = upcoming[0];
  const chosen = upcoming.find((e) => e.id === picked);
  const selected = desk ? (chosen ?? next) : undefined;
  const opened = desk ? undefined : chosen;

  const main = useRef<HTMLElement>(null);
  const side = useRef<HTMLElement>(null);
  const gallery = useRef<HTMLElement>(null);
  const probe = useRef<HTMLDivElement>(null);
  const skeletons = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const focusTitle = useRef(false);
  const pushed = useRef(false);
  const grow = useRef(false);
  const viewed = useRef<string | undefined>(undefined);
  const [fit, setFit] = useState<Fit | null>(null);
  const [width, setWidth] = useState(0);
  const [lifted, setLifted] = useState(false);
  // The opened event stays on screen while it leaves, even once the address no longer names it.
  const [viewing, setViewing] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (opened) setViewing(opened.id);
    else if (desk) setViewing(undefined);
  }, [opened, desk]);

  // Laptops: the column is as wide as the stack that fits the screen, at one size for every event. Its heading takes
  // 34px of the room: a 22px line and 12px under it.
  useLayoutEffect(() => {
    const el = side.current;
    if (!desk || !el || !probe.current) return setFit(null);
    const cs = getComputedStyle(el);
    const room = el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 34;
    const shapes = upcoming.length ? upcoming.map(stackShape) : [1.6];
    setFit(fitStack(probe.current, shapes, column(viewport.w), room));
  }, [desk, viewport, upcoming]);

  useLayoutEffect(() => {
    const el = gallery.current;
    if (!el) return;
    const cs = getComputedStyle(el);
    setWidth(el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight));
  }, [desk, viewport, fit]);

  // The skeletons take only the height left on the screen, so they never make it scroll, and with too little room
  // they go. Off laptops they run under the Events and You switch, since they fade out and hold nothing; without them
  // the page keeps just enough room at its foot to lift the follow link clear of the switch.
  useLayoutEffect(() => {
    const page = main.current;
    const box = skeletons.current;
    if (!page) return;
    page.style.paddingBottom = "";
    if (!box) return;
    box.hidden = false;
    box.style.height = "";
    const end = desk ? innerHeight - 48 : innerHeight;
    const h = end - box.getBoundingClientRect().top - scrollY;
    if (h < (phone ? 96 : 160)) {
      box.hidden = true;
      if (!desk) page.style.paddingBottom = `${Math.max(0, 104 - Math.max(h, 0))}px`;
      return;
    }
    box.style.height = `${h}px`;
    if (!desk) page.style.paddingBottom = "0px";
  });

  // When the column scrolls on its own, a fade under the bar shows where its top has gone.
  const lift = () => setLifted((side.current?.scrollTop ?? 0) > 0);
  useLayoutEffect(() => {
    if (side.current) side.current.scrollTop = 0;
    lift();
  }, [fit, selected]);

  useEffect(() => {
    if (!focusTitle.current) return;
    focusTitle.current = false;
    title.current?.focus({ preventScroll: true });
  }, [picked]);

  // Leaving an opened event, by any way, puts the member back on its tile.
  useEffect(() => {
    if (viewing) return;
    const id = viewed.current;
    viewed.current = undefined;
    if (!id) return;
    const pick = document.querySelector<HTMLElement>(`.gal [data-event="${CSS.escape(id)}"] .pick`);
    pick?.scrollIntoView({ block: "nearest", inline: "nearest" });
    pick?.focus({ preventScroll: true });
  }, [viewing]);

  function pick(id: string) {
    if (!desk) {
      pushed.current = true;
      grow.current = true;
      void navigate({ to: ".", search: { event: id }, resetScroll: false });
    } else if (id === selected?.id) {
      title.current?.focus({ preventScroll: true });
    } else {
      focusTitle.current = true;
      void navigate({ to: ".", search: { event: id }, replace: true, resetScroll: false });
    }
  }

  function close() {
    grow.current = false;
    if (pushed.current) {
      pushed.current = false;
      router.history.back();
    } else {
      void navigate({ to: ".", search: {}, replace: true, resetScroll: false });
    }
  }

  // Off laptops a row and its captions also fit the screen's height, for a phone on its side.
  const gap = phone ? 16 : 24;
  const target = Math.min(
    phone
      ? Math.round(Math.min(220, 0.5 * viewport.w))
      : Math.max(180, Math.min(300, width / 2.9, fit ? 0.875 * fit.width : 300)),
    desk ? Infinity : Math.max(180, viewport.h - 230),
  );
  const grid = { width, gap, target, phone };

  function content() {
    if (upcoming.length) {
      return (
        <>
          <Gallery
            {...grid}
            events={upcoming}
            now={now}
            next={next}
            selected={selected}
            onPick={pick}
          />
          {upcoming.length === 1 ? <Skeletons box={skeletons} {...grid} /> : null}
        </>
      );
    }
    if (desk) return <Skeletons box={skeletons} {...grid} />;
    if (phone)
      return (
        <>
          <div className="empty stk">
            <Picture event={NONE} width={width} height={width / 1.6} />
            <Nothing />
          </div>
          <Skeletons box={skeletons} {...grid} />
        </>
      );
    // Tablets keep the laptop's column for the message, with the skeletons beside it.
    const w = column(viewport.w);
    const g = columnGap(viewport.w);
    const rest = width - w - g;
    return (
      <div className="zcol" style={{ "--zw": `${w}px`, "--cg": `${g}px` } as CSSProperties}>
        <div className="stk">
          <p className="mh">
            <b className="mo">Next up</b>
          </p>
          <Picture event={NONE} width={w} height={Math.min(w / 1.6, 0.3 * viewport.h)} />
          <Nothing />
        </div>
        <Skeletons
          box={skeletons}
          {...grid}
          width={rest}
          target={Math.max(180, Math.min(300, rest / 2.9))}
        />
      </div>
    );
  }

  return (
    <div
      className="you events"
      style={fit ? ({ "--fw": `${fit.width}px` } as CSSProperties) : undefined}
    >
      <Bar signOut nav={<Pages />} className="bar" />
      <main ref={main}>
        <h1 className="sr-only">Events</h1>
        {desk ? (
          <aside
            ref={side}
            className={lifted ? "side-event lifted" : "side-event"}
            aria-label={selected ? "Selected event" : undefined}
            style={fit ? ({ "--t": fit.t } as CSSProperties) : undefined}
            onScroll={lift}
          >
            {fit ? (
              <>
                <p className="mh">
                  <b className="mo">
                    {selected && selected !== next ? away(selected, now) : "Next up"}
                  </b>
                  {selected === next && selected ? (
                    <span className="n">{away(selected, now)}</span>
                  ) : null}
                </p>
                <div className="stk">
                  {selected ? (
                    <>
                      <Picture
                        event={selected}
                        width={fit.width}
                        height={fit.width / stackShape(selected)}
                      >
                        <Zoom event={selected} />
                      </Picture>
                      <Details
                        event={selected}
                        now={now}
                        next={selected === next}
                        narrow={fit.width / fit.t < 300}
                        title={title}
                      />
                    </>
                  ) : (
                    <>
                      <Picture event={NONE} width={fit.width} height={fit.width / 1.6} />
                      <Nothing />
                    </>
                  )}
                </div>
              </>
            ) : null}
          </aside>
        ) : null}
        <section ref={gallery} className="gal" aria-label="Upcoming events">
          {width ? content() : null}
        </section>
      </main>
      <Pages dock />
      <div ref={probe} className="probe" aria-hidden inert>
        {upcoming.length ? (
          upcoming.map((e) => (
            <div key={e.id} className="stk">
              <Details event={e} now={now} next={e === next} eyebrow={!desk} />
            </div>
          ))
        ) : (
          <div className="stk">
            <Nothing />
          </div>
        )}
      </div>
      {viewing && !desk ? (
        <View
          events={upcoming}
          start={Math.max(
            0,
            upcoming.findIndex((e) => e.id === viewing),
          )}
          now={now}
          next={next}
          probe={probe}
          grow={grow.current}
          away={!opened}
          onPage={(id) =>
            void navigate({ to: ".", search: { event: id }, replace: true, resetScroll: false })
          }
          onClose={close}
          onGone={(id) => {
            viewed.current = id;
            grow.current = false;
            setViewing(undefined);
          }}
        />
      ) : null}
      <p id="events-status" className="sr-only" role="status" />
    </div>
  );
}
