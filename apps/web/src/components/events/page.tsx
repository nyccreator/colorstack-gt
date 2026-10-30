import { useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { DESK, PHONE, useMedia } from "@/lib/media";

import { Bar, Pages } from "../frame";
import { type ClubEvent, isPast } from "./data";
import {
  Actions,
  away,
  Details,
  type Fit,
  fitStack,
  monthOf,
  Nothing,
  Picture,
  semesterOf,
  stackShape,
} from "./detail";
import { Gallery, remeasure, Skeletons } from "./gallery";
import { tileOf, View } from "./view";

const NONE = {};

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

function focusTile(id: string) {
  const pick = tileOf(id)?.querySelector<HTMLElement>(".pick");
  pick?.scrollIntoView({ block: "nearest", inline: "nearest" });
  pick?.focus({ preventScroll: true });
}

export function EventsPage({ events, picked }: { events: ClubEvent[]; picked?: string }) {
  const navigate = useNavigate();
  const router = useRouter();
  const desk = useMedia(DESK);
  const phone = useMedia(PHONE);
  const viewport = useViewport();
  const [now, setNow] = useState(Date.now);
  const upcoming = useMemo(() => events.filter((e) => !isPast(e, now)), [events, now]);
  const past = useMemo(() => events.filter((e) => isPast(e, now)).reverse(), [events, now]);
  const sizedBy = upcoming.length ? upcoming : events;
  const shapes = useMemo(() => sizedBy.map(stackShape), [sizedBy]);
  const next = upcoming[0];
  const chosen = events.find((e) => e.id === picked);
  const selected = desk ? (chosen ?? next) : undefined;
  const opened = desk ? undefined : chosen;
  const selectedPast = !!selected && isPast(selected, now);

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
  const lastViewed = useRef<string | undefined>(undefined);
  const [fit, setFit] = useState<Fit | null>(null);
  const [width, setWidth] = useState(0);
  const [onScreen, setOnScreen] = useState<string | undefined>(undefined);
  if (opened && opened.id !== onScreen) setOnScreen(opened.id);
  else if (!opened && desk && onScreen) setOnScreen(undefined);

  useEffect(() => {
    const wake = () => {
      if (!document.hidden) setNow(Date.now());
    };
    document.addEventListener("visibilitychange", wake);
    return () => document.removeEventListener("visibilitychange", wake);
  }, []);

  useLayoutEffect(() => {
    const el = side.current;
    const stk = stack.current;
    const pr = probe.current;
    if (!desk || !el || !stk || !pr) return setFit(null);
    return remeasure(pr, () => {
      const room = el.clientHeight - parseFloat(getComputedStyle(el).paddingBottom) - stk.offsetTop;
      const next = fitStack(pr, shapes.length ? shapes : [1.6], column(viewport.w), room);
      setFit((f) => (f?.width === next.width && f.t === next.t ? f : next));
    });
  }, [desk, viewport, shapes]);

  useLayoutEffect(() => {
    const el = gallery.current;
    if (!el) return;
    return remeasure(el, () => {
      const cs = getComputedStyle(el);
      setWidth(el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight));
    });
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
  }, [desk, phone, viewport, width, fit, upcoming.length, past.length]);

  useLayoutEffect(() => {
    if (side.current) side.current.scrollTop = 0;
  }, [fit, selected?.id]);

  useEffect(() => {
    if (!focusTitle.current) return;
    focusTitle.current = false;
    title.current?.focus({ preventScroll: true });
  }, [picked]);

  useEffect(() => {
    if (onScreen) return;
    const id = lastViewed.current;
    lastViewed.current = undefined;
    if (id) focusTile(id);
  }, [onScreen]);

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
  const viewing = past.some((e) => e.id === onScreen) ? past : upcoming;

  const pastEvents = (w = width) =>
    past.length ? (
      <section className="past-events" aria-label="Past events">
        <h2 className="past-title">Past events</h2>
        <Gallery
          {...grid}
          width={w}
          events={past}
          now={now}
          selected={selected}
          group={semesterOf}
          onPick={pick}
        />
      </section>
    ) : null;

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
            group={(t) => monthOf(t, now)}
            fill={!past.length}
            onPick={pick}
          />
          {upcoming.length === 1 && !past.length ? <Skeletons box={skeletons} {...grid} /> : null}
          {pastEvents()}
        </>
      );
    }
    if (desk) return pastEvents() ?? <Skeletons box={skeletons} {...grid} />;
    if (phone)
      return (
        <>
          <div className="empty stk">
            {past.length ? null : <Picture event={NONE} width={width} height={width / 1.6} />}
            <Nothing />
          </div>
          {pastEvents() ?? <Skeletons box={skeletons} {...grid} />}
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
        {pastEvents(rest) ?? <Skeletons box={skeletons} {...grid} width={rest} />}
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
                {selectedPast
                  ? "Past event"
                  : selected && selected !== next
                    ? away(selected, now)
                    : "Next up"}
              </b>
              {selected && (selected === next || selectedPast) ? (
                <span className="n">{away(selected, now)}</span>
              ) : null}
            </p>
            <div ref={stack} className="stk">
              {!fit ? null : selected ? (
                <>
                  <Picture
                    key={`flier-${selected.id}`}
                    event={selected}
                    width={fit.width}
                    height={fit.width / stackShape(selected)}
                  >
                    <Actions event={selected} mode="corner" now={now} />
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
        <section ref={gallery} className="gal" aria-label="Events">
          {width ? content() : null}
        </section>
      </main>
      <Pages dock />
      <div ref={probe} className="probe" aria-hidden inert>
        {sizedBy.length ? (
          sizedBy.map((e) => (
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
      {onScreen && !desk ? (
        <View
          events={viewing}
          shapes={shapes}
          start={Math.max(
            0,
            viewing.findIndex((e) => e.id === onScreen),
          )}
          now={now}
          next={next}
          probe={probe}
          grow={grow}
          stayOpen={!!opened}
          onPage={(id) =>
            void navigate({ to: ".", search: { event: id }, replace: true, resetScroll: false })
          }
          onClose={close}
          onGone={(id) => {
            lastViewed.current = id;
            grow.current = false;
            setOnScreen(undefined);
          }}
        />
      ) : null}
      <p id="events-status" className="sr-only" role="status" />
    </div>
  );
}
