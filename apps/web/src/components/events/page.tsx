import { useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { DESK, PHONE, useMedia } from "@/lib/media";

import { Bar, Pages } from "../frame";
import { EVENTS } from "./data";
import { Actions, away, Details, type Fit, fitStack, Nothing, Picture, stackShape } from "./detail";
import { Gallery, Skeletons } from "./gallery";
import { View } from "./view";

const NONE = { art: "event", tone: "navy-medium" } as const;

function useViewport() {
  const [size, setSize] = useState(() => ({ w: innerWidth, h: innerHeight }));
  useEffect(() => {
    const resize = () => setSize({ w: innerWidth, h: innerHeight });
    addEventListener("resize", resize);
    return () => removeEventListener("resize", resize);
  }, []);
  return size;
}

const column = (w: number) => Math.max(300, Math.min(330, 0.22 * w));
const columnGap = (w: number) => Math.max(40, Math.min(64, 0.045 * w));
// Every gallery row is one height: the lowest at which a 3:4 flier, the narrowest shape Instagram's feed
// shows, still fits its whole caption of date, QR and Add (phones' caption type is smaller).
const ROW = 264;
const PHONE_ROW = 240;

export function EventsPage({ picked }: { picked?: string }) {
  const navigate = useNavigate();
  const router = useRouter();
  // The router restores the page's scroll as it settles, so a closing event waits for that to find its tile.
  const settled = useRouterState({ select: (s) => s.status === "idle" });
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
  const stack = useRef<HTMLDivElement>(null);
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
  // The opened event stays on screen while it leaves, even once the address no longer names it.
  const [viewing, setViewing] = useState<string | undefined>(undefined);
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- The viewed event must outlive the address while it flies back.
    if (opened) setViewing(opened.id);
    else if (desk) setViewing(undefined);
  }, [opened, desk]);

  // The probe is watched too, so a font that loads late refits the stack.
  useLayoutEffect(() => {
    const el = side.current;
    const stk = stack.current;
    const pr = probe.current;
    if (!desk || !el || !stk || !pr) return setFit(null);
    const measure = () => {
      const room = el.clientHeight - parseFloat(getComputedStyle(el).paddingBottom) - stk.offsetTop;
      const shapes = upcoming.length ? upcoming.map(stackShape) : [1.6];
      const next = fitStack(pr, shapes, column(viewport.w), room);
      setFit((f) => (f?.width === next.width && f.t === next.t ? f : next));
    };
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(pr);
    return () => watch.disconnect();
  }, [desk, viewport, upcoming]);

  useLayoutEffect(() => {
    const el = gallery.current;
    if (!el) return;
    const measure = () => {
      const cs = getComputedStyle(el);
      setWidth(el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight));
    };
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(el);
    return () => watch.disconnect();
  }, [desk, viewport, fit]);

  useLayoutEffect(() => {
    const page = main.current;
    const box = skeletons.current;
    if (!page || !gallery.current) return;
    page.style.paddingBottom = "";
    if (!box) return;
    box.hidden = false;
    box.style.height = "";
    const end = innerHeight - parseFloat(getComputedStyle(gallery.current).paddingBottom);
    const h = end - box.getBoundingClientRect().top - scrollY;
    if (h < (phone ? 96 : 160)) {
      box.hidden = true;
      if (!desk) {
        const foot = parseFloat(getComputedStyle(document.documentElement).scrollPaddingBottom);
        page.style.paddingBottom = `${Math.max(0, foot - Math.max(h, 0))}px`;
      }
      return;
    }
    box.style.height = `${h}px`;
    if (!desk) page.style.paddingBottom = "0px";
  }, [desk, phone, viewport, width, fit, upcoming.length]);

  useLayoutEffect(() => {
    if (side.current) side.current.scrollTop = 0;
  }, [fit, selected]);

  useEffect(() => {
    if (!focusTitle.current) return;
    focusTitle.current = false;
    title.current?.focus({ preventScroll: true });
  }, [picked]);

  // Focus returns to the tile of the event last viewed, which the dialog's own focus return can't know.
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

  const gap = phone ? 16 : 24;
  const grid = { width, gap, row: phone ? PHONE_ROW : ROW, phone };

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
    const w = column(viewport.w);
    const g = columnGap(viewport.w);
    const rest = width - w - g;
    return (
      <div className="zcol" style={{ "--zw": `${w}px`, "--cg": `${g}px` }}>
        <div className="stk">
          <p className="mh">
            <b className="mo">Next up</b>
          </p>
          <Picture event={NONE} width={w} height={Math.min(w / 1.6, 0.3 * viewport.h)} />
          <Nothing />
        </div>
        <Skeletons box={skeletons} {...grid} width={rest} />
      </div>
    );
  }

  return (
    <div className="you events" style={fit ? { "--fw": `${fit.width}px` } : undefined}>
      <Bar signOut nav={<Pages />} className="bar" />
      <main ref={main}>
        <h1 className="sr-only">Events</h1>
        {desk ? (
          <aside
            ref={side}
            className="side-event"
            aria-label={selected ? "Selected event" : undefined}
            style={fit ? { "--t": fit.t } : undefined}
          >
            <p className="mh">
              <b className="mo">
                {selected && selected !== next ? away(selected, now) : "Next up"}
              </b>
              {selected === next && selected ? (
                <span className="n">{away(selected, now)}</span>
              ) : null}
            </p>
            <div ref={stack} className="stk">
              {!fit ? null : selected ? (
                <>
                  <Picture
                    event={selected}
                    width={fit.width}
                    height={fit.width / stackShape(selected)}
                  >
                    <Actions event={selected} mode="corner" />
                  </Picture>
                  <Details
                    key={selected.id}
                    event={selected}
                    now={now}
                    next={selected === next}
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
          // oxlint-disable-next-line react/refs -- Read once as the dialog mounts, to know whether it grows from a tile.
          grow={grow.current}
          routed={!!opened || !settled}
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
