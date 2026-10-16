import { ConvexError } from "convex/values";

import { APPEAR, BUSY_AFTER, MOVE, still } from "@/lib/motion";

export type Gid = "who" | "contact" | "studies" | "career" | "interests" | "background";
export type Eid = Exclude<Gid, "career"> | "res" | "lnk";
export type Value = string | string[];
export type Draft = Record<string, Value>;
export type Row = { key: string; label: string; value: string; fixed?: boolean };
type Next = { gid: Gid; key: string };

export type EditorDef = {
  focus: Record<string, string>;
  draft: () => Draft;
  check: (d: Draft) => Record<string, string>;
  change?: (k: string, d: Draft, prev: Value | undefined) => string | void;
  toggle?: (k: string, v: string, d: Draft) => void;
  chips?: boolean;
  instant?: boolean;
};

export type Ed = {
  gid: Gid;
  key: string;
  eid: Eid;
  sec: HTMLElement;
  draft: Draft;
  base: string;
  before: Row[];
  shown: Set<string>;
  asking: boolean;
  error: string | null;
  busy: boolean;
  saving: boolean;
  labelAt: number;
  last: HTMLElement | null;
  next: Next | null;
  after: Next | null;
  target: HTMLElement | null;
  y0: number;
  moved: boolean;
  free: boolean;
};

export type Res = {
  confirm: boolean;
  busy: "upload" | "remove" | null;
  error: string | null;
  book: "in" | "out" | null;
  bookLabel: "saving" | "saved" | null;
  bookError: string | null;
};

export type Deps = {
  commit: () => void;
  title: (gid: Gid) => string;
  rows: (gid: Gid) => Row[];
  editors: Record<Eid, EditorDef>;
  save: (eid: Eid, d: Draft) => Promise<unknown>;
  setBook: (on: boolean) => Promise<unknown>;
  upload: (file: File) => Promise<string | null>;
  removeResume: () => Promise<unknown>;
  hasResume: () => boolean;
  inBook: () => boolean;
};

type Plan = {
  top?: number | null;
  closing?: boolean;
  dur?: number;
  pin?: Pin;
  solid?: Element | null;
  after?: (dur: number, clips: Map<Element, number>) => void;
  enter?: Element[] | (() => Element[]);
};
type Pin = { sec: HTMLElement; el: Element; mid: boolean; from: number; delta?: number };

const ZONE_TOP = 16;
const SCROLL_KEYS = new Set([" ", "PageUp", "PageDown", "Home", "End", "ArrowUp", "ArrowDown"]);
const VISIBLE = "you-visible";
const FAILED = "We couldn't save that. Check your connection and try again.";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// MOVE as a function, for the page's own scroll, which no CSS easing can drive.
const glideCurve = (x: number) => {
  const at = (t: number, p1: number, p2: number) =>
    3 * p1 * t * (1 - t) ** 2 + 3 * p2 * t * t * (1 - t) + t ** 3;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (at(mid, 0.32, 0) < x) lo = mid;
    else hi = mid;
  }
  return at((lo + hi) / 2, 0.72, 1);
};
// Answers compare as sets, so turning one off and on again isn't a change.
const flat = (v: Value | undefined) => JSON.stringify(Array.isArray(v) ? [...v].sort() : v);
const snap = (d: Draft) => JSON.stringify(Object.entries(d).map(([k, v]) => [k, flat(v)]));
const message = (failure: unknown) =>
  failure instanceof ConvexError ? String(failure.data) : FAILED;

export type Editing = ReturnType<typeof createEditing>;

export function createEditing(root: HTMLElement, deps: Deps) {
  const $ = <T extends Element = HTMLElement>(s: string, el: ParentNode = root) =>
    el.querySelector<T>(s);
  const $$ = <T extends Element = HTMLElement>(s: string, el: ParentNode = root) => [
    ...el.querySelectorAll<T>(s),
  ];
  const coarse = matchMedia("(pointer: coarse)").matches;
  const reduce = still;
  const { commit, editors } = deps;

  let ed: Ed | null = null;
  const res: Res = {
    confirm: false,
    busy: null,
    error: null,
    book: null,
    bookLabel: null,
    bookError: null,
  };
  const E = (e: Ed) => editors[e.eid];
  const form = () => $<HTMLFormElement>("form", ed!.sec)!;
  const act = () => $(".act", form())!;

  const narrow = () => ($(".groups")?.clientWidth ?? 0) < 520;
  const T = () =>
    reduce()
      ? { open: 0, close: 0, fadeIn: 120, fadeOut: 90, stagger: 0, rise: 0 }
      : narrow()
        ? { open: 400, close: 300, fadeIn: 180, fadeOut: 70, stagger: 20, rise: 8 }
        : { open: 260, close: 220, fadeIn: 160, fadeOut: 70, stagger: 18, rise: 6 };
  let running: Animation[] = [];
  let generation = 0;
  const anim = (el: Element, kf: Keyframe[], o: KeyframeAnimationOptions) => {
    const a = el.animate(kf, { fill: "backwards", ...o });
    running.push(a);
    return a;
  };
  // A group is placed by its panel, so a heading that grows into the gap above doesn't count as movement.
  const anchor = (el: Element) =>
    (el.matches(".grp") ? $(".gp", el)! : el).getBoundingClientRect().top;
  const headBox = (sec: Element) => {
    const el = $(".gh h2", sec)!;
    const r = el.getBoundingClientRect();
    return {
      el,
      w: r.width,
      x: r.left - sec.getBoundingClientRect().left,
      y: r.bottom - $(".gp", sec)!.getBoundingClientRect().top,
    };
  };
  // A ghost copies what is on screen now, mid-fade included, so turning around never flashes.
  function snapshot(el: Element, blank: Element | null | undefined) {
    const c = el.cloneNode(true) as Element;
    const src = [el, ...el.querySelectorAll("*")];
    const dst = [c, ...c.querySelectorAll("*")];
    src.forEach((s, i) => {
      const d = dst[i] as HTMLElement;
      if (s.getAnimations().length) {
        const cs = getComputedStyle(s);
        d.style.opacity = cs.opacity;
        d.style.transform = cs.transform;
      }
      if (s === blank) d.classList.add("blank");
    });
    return c;
  }

  // Every block keeps its on-screen place for the first frame, then glides to where the change put it.
  function choreograph(
    change: () => Plan | void,
    {
      swap = [],
      track = [],
      enterOrder,
      blank,
    }: {
      swap?: Element[];
      track?: Element[];
      enterOrder?: (el: Element, i: number) => number;
      blank?: Element | null;
    } = {},
  ) {
    const t = T();
    const blocks = [...$$(".bar, .side, .grp"), ...track];
    const first = new Map(blocks.map((el) => [el, anchor(el)]));
    const heads = swap.map((sec) => ({ sec, ...headBox(sec) }));
    const ghosts = swap.map((sec) => {
      const gp = $(".gp", sec)!;
      return {
        sec,
        h: gp.getBoundingClientRect().height,
        kids: [...gp.children].filter((c) => !c.matches(".ghost")).map((c) => snapshot(c, blank)),
      };
    });
    // Scroll anchoring sits out until the motion ends: Chromium would shift the page when a ghost leaves, and
    // WebKit counts the transforms as movement and scrolls against them.
    document.documentElement.style.overflowAnchor = "none";
    for (const a of running) a.cancel();
    running = [];
    $$(".ghost").forEach((g) => g.remove());
    const plan: Plan = change() ?? {};
    const dur = reduce() ? 0 : (plan.dur ?? (plan.closing ? t.close : t.open));
    const moved = new Map<Element, number>();
    const pin = plan.pin;
    const clips = new Map<Element, number>();
    for (const el of blocks) {
      if (!el.isConnected) continue;
      let dy = first.get(el)! - anchor(el);
      // The tapped row and its field are one thing: the group glides so that it never jumps.
      if (pin && el === pin.sec) {
        const d = pin.from - pinY(pin);
        pin.delta = dy - d;
        dy = d;
      }
      moved.set(el, dy);
      const parent = el.closest(".grp");
      const own = dy - (track.includes(el) && parent ? (moved.get(parent) ?? 0) : 0);
      if (dur && Math.abs(own) > 0.5) {
        anim(el, [{ transform: `translateY(${own}px)` }, { transform: "none" }], {
          duration: dur,
          easing: MOVE,
        });
      }
    }
    // The group label grows into the editor's heading and shrinks back; its line travels with the text.
    for (const h of heads) {
      const now = headBox(h.sec);
      const k = h.w / now.w;
      const dx = h.x - now.x;
      const dy = h.y - now.y + (h.sec === pin?.sec ? (pin.delta ?? 0) : 0);
      if (dur && (Math.abs(dy) > 0.5 || Math.abs(dx) > 0.5)) {
        anim(
          now.el.parentElement!,
          [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }],
          { duration: dur, easing: MOVE },
        );
      }
      if (dur && Math.abs(k - 1) > 0.005) {
        anim(now.el, [{ transform: `scale(${k})` }, { transform: "none" }], {
          duration: dur,
          easing: MOVE,
        });
      }
    }
    for (const g of ghosts) {
      const gp = $(".gp", g.sec)!;
      const h = gp.getBoundingClientRect().height;
      const ghost = document.createElement("div");
      ghost.className = "ghost";
      ghost.setAttribute("aria-hidden", "true");
      ghost.inert = true;
      ghost.style.height = `${g.h}px`;
      ghost.append(...g.kids);
      for (const x of ghost.querySelectorAll("[id]")) x.removeAttribute("id");
      const d = g.sec === pin?.sec ? (pin.delta ?? 0) : 0;
      if (d) ghost.style.transform = `translateY(${d}px)`;
      gp.append(ghost);
      anim(ghost, [{ opacity: 1 }, { opacity: 0 }], {
        duration: t.fadeOut,
        easing: "ease-out",
        fill: "forwards",
      }).finished.then(
        () => ghost.remove(),
        () => {},
      );
      // The panel's edges travel with the content around it, kept 8px clear so a field's focus ring is never cut.
      const top = Math.max(0, d);
      const bot = Math.max(0, h - d - g.h);
      if (dur && (top || bot)) {
        anim(
          gp,
          [
            { clipPath: `inset(${top}px -8px ${bot}px -8px round 24px)` },
            { clipPath: "inset(0 -8px 0 -8px round 0)" },
          ],
          { duration: dur, easing: MOVE },
        );
      }
      clips.set(g.sec, gp.getBoundingClientRect().top + h - bot);
      const gTop = Math.max(0, -d);
      const gBot = Math.max(0, g.h + d - h);
      if (dur && (gTop || gBot)) {
        anim(
          ghost,
          [{ clipPath: "inset(0 0 0 0)" }, { clipPath: `inset(${gTop}px 0 ${gBot}px 0)` }],
          { duration: dur, easing: MOVE },
        );
      }
    }
    plan.after?.(dur, clips);
    const enter = typeof plan.enter === "function" ? plan.enter() : (plan.enter ?? []);
    enter.forEach((el, i) => {
      const o = {
        duration: t.fadeIn,
        delay: (reduce() ? 0 : 30) + Math.min(enterOrder ? enterOrder(el, i) : i, 4) * t.stagger,
        easing: APPEAR,
      };
      if (el !== plan.solid) {
        const rise = t.rise && !el.matches(".act");
        return anim(
          el,
          rise
            ? [
                { opacity: 0, transform: `translateY(${t.rise}px)` },
                { opacity: 1, transform: "none" },
              ]
            : [{ opacity: 0 }, { opacity: 1 }],
          o,
        );
      }
      // The focused field is never transparent, or WebKit hides its caret; only its label fades in.
      const k = $(":scope > .k", el);
      if (k) anim(k, [{ opacity: 0 }, { opacity: 1 }], o);
    });
    // The page's own scroll moves on the same curve rather than jumping: iOS shows a scroll set from script a
    // frame before it shows the transforms meant to hide it.
    if (plan.top != null) glideTo(plan.top, dur);
    const gen = ++generation;
    Promise.allSettled(running.map((a) => a.finished)).then(() => {
      if (gen === generation) document.documentElement.style.overflowAnchor = "";
    });
    return plan;
  }

  // A row and its field line up on the value, so the text stays put and the field grows around it.
  const mid = (el: Element) => {
    const r = el.getBoundingClientRect();
    return r.top + r.height / 2;
  };
  const control = (block: Element) => $("input:not([type=file]), select", block);
  const pinY = (p: Pin) => (p.mid ? mid(p.el) : p.el.getBoundingClientRect().top);

  // iOS reports element positions from the top of the visible area but anchors sticky and fixed elements to a
  // taller layout area that it slides around, so the keyboard code measures against the visible area itself.
  const typing = () =>
    coarse && !!document.activeElement?.matches("input:not([type=file]):not([readonly])");
  // A fixed probe marks the layout area's top; adding the viewport's own offset finds the visible area's top in
  // the coordinates element positions use, on iOS and Android alike.
  const probe = document.createElement("i");
  probe.style.cssText =
    "position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none";
  const view = () => {
    const vv = visualViewport;
    const top = vv ? probe.getBoundingClientRect().top + vv.offsetTop : 0;
    const height = vv?.height ?? innerHeight;
    return { top, bottom: top + height, height };
  };
  const keyboardUp = () => typing() && view().height < innerHeight - 80;
  // Where the bar stays over the page, a group is only in view below it.
  const under = () => {
    const b = $(".bar");
    return b && getComputedStyle(b).position === "fixed" ? b.offsetHeight : 0;
  };

  // The visible height above each kind of keyboard, as this device last reported it. Safari's toolbar changes the
  // window's height but not this, so it holds whichever way the toolbar is.
  let seen: Record<string, number> = {};
  try {
    seen = JSON.parse(localStorage.getItem(VISIBLE) ?? "{}") ?? {};
  } catch {}
  const kindOf = (el: Element | null) =>
    `${el?.matches("[type=tel], [inputmode=numeric], [inputmode=decimal]") ? "num" : "text"}:${innerWidth > innerHeight ? "l" : "p"}`;
  const visibleWith = (el: Element) =>
    seen[kindOf(el)] ?? Math.round((innerWidth > innerHeight ? innerHeight : screen.height) * 0.45);
  function measure() {
    const vv = visualViewport;
    if (!vv || !keyboardUp() || Math.abs(vv.scale - 1) > 0.01) return;
    seen[kindOf(document.activeElement)] = Math.round(vv.height);
    try {
      localStorage.setItem(VISIBLE, JSON.stringify(seen));
    } catch {}
  }

  // The page's own scroll. A phone runs its own smooth scroll off the page's main work, so a keyboard opening
  // can't stall it; elsewhere it moves on MOVE. A touch hands the page back to the member at once.
  let glide = 0;
  function glideTo(top: number, dur: number) {
    cancelAnimationFrame(glide);
    const from = scrollY;
    if (!dur || Math.abs(top - from) < 1) {
      return window.scrollTo(0, top);
    }
    if (coarse) {
      return window.scrollTo({ top, behavior: "smooth" });
    }
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - start) / dur));
      window.scrollTo(0, from + (top - from) * glideCurve(p));
      if (p < 1) glide = requestAnimationFrame(step);
    };
    glide = requestAnimationFrame(step);
  }
  const stopGlide = () => cancelAnimationFrame(glide);
  // Once the member drags or scrolls the page, it is theirs: nothing corrects it and closing leaves it there.
  const released = () => {
    stopGlide();
    if (ed) ed.free = true;
    checkBack();
  };

  // iOS opens the keyboard only for a focus inside the tap, and then reveals that field itself, undoing any scroll
  // made since. So the tap focuses a stand-in at the top of the visible area, which needs no revealing, and focus
  // moves to the real field once the page has brought it into view; the keyboard stays up throughout.
  const standIn = document.createElement("input");
  standIn.tabIndex = -1;
  standIn.setAttribute("aria-hidden", "true");
  standIn.style.cssText =
    "position:fixed;left:0;width:1px;height:1px;margin:0;padding:0;border:0;opacity:0;font-size:16px;pointer-events:none";
  let handoff = 0;
  function focusVia(target: HTMLInputElement, dur: number) {
    clearTimeout(handoff);
    standIn.type = target.type;
    standIn.inputMode = target.inputMode;
    standIn.autocomplete = target.autocomplete;
    standIn.value = "";
    standIn.style.top = `${(visualViewport?.offsetTop ?? 0) + 8}px`;
    standIn.focus({ preventScroll: true });
    handoff = window.setTimeout(() => {
      if (document.activeElement !== standIn || ed?.target !== target) return;
      target.focus({ preventScroll: true });
      if (standIn.value) {
        target.value += standIn.value;
        target.dispatchEvent(new Event("input", { bubbles: true }));
      }
      standIn.value = "";
    }, dur);
  }

  // The zone a field sits in: under the pinned title on phones, which unpins while the keyboard is up, and above the
  // keyboard, or above where a keyboard still to come will reach.
  const titleH = (kb = false) =>
    narrow() && !kb && !typing() ? ($(".grp.open .gh")?.offsetHeight ?? 0) : 0;
  type Zone = { top: number; bottom: number; edge: number };
  const zone = (focusEl?: Element, kb = false): Zone => {
    const v = view();
    const coming = kb && focusEl && v.height >= innerHeight - 80;
    const bottom = coming ? v.top + visibleWith(focusEl) : v.bottom;
    const edge = v.top + under();
    return { top: edge + ZONE_TOP + titleH(kb), bottom: bottom - (narrow() ? 8 : 24), edge };
  };
  // The scroll an open editor needs: the field with Save under it when both fit in the zone, otherwise the field
  // alone, staying nearest `want` and never pushing an on-screen heading off when a smaller scroll would do. The
  // first field brings whatever sits above it in the form, such as the privacy note.
  function scrollFor(f: HTMLElement, block: Element, z: Zone, want = 0) {
    const r = block.getBoundingClientRect();
    const head = f.closest(".grp")!.getBoundingClientRect().top - z.edge;
    const hi = (block === $(".f", f) ? f : block).getBoundingClientRect().top - z.top;
    let lo = f.parentElement!.getBoundingClientRect().bottom - z.bottom;
    if (lo > hi) lo = r.bottom - z.bottom;
    if (lo > hi) return hi;
    const cap = head >= ZONE_TOP ? Math.min(hi, head - ZONE_TOP) : hi;
    return Math.min(Math.max(want, lo), cap >= lo ? cap : hi);
  }
  function targetFor(e: Ed, focusEl: Element, kb: boolean, pin?: Pin) {
    const f = $<HTMLFormElement>("form", e.sec)!;
    const block = focusEl.closest(".f") ?? $(".f", f)!;
    const z = zone(focusEl, kb);
    const head = e.sec.getBoundingClientRect().top;
    const fr = f.getBoundingClientRect();
    const top = z.edge + ZONE_TOP;
    // Chip editors on phones open with the whole group in view when it fits, or else the form's top under the title,
    // even when the form runs on below the screen.
    const d =
      narrow() && !kb && E(e).chips && fr.bottom - head <= z.bottom - top
        ? head - top
        : narrow() && !kb && E(e).chips
          ? fr.top - z.top
          : scrollFor(f, block, z, pin ? pinY(pin) - pin.from : 0);
    return Math.abs(d) < 1 ? null : scrollY + d;
  }

  // Once the keyboard has landed or the screen has turned: if the field or Save is out of view, one short glide.
  function settled() {
    if (!ed || ed.free) return;
    const e = ed;
    const f = form();
    const el = f.contains(document.activeElement) ? document.activeElement : e.target;
    const block = el?.closest(".f") ?? $(".f", f);
    if (!block) return;
    const z = zone();
    const r = block.getBoundingClientRect();
    const fb = f.parentElement!.getBoundingClientRect().bottom;
    const low = (fb - r.top <= z.bottom - z.top ? fb : r.bottom) - z.bottom;
    const need = low > 1 ? low : r.top < z.top ? r.top - z.top : 0;
    if (Math.abs(need) < 1) return;
    const to = scrollY + need;
    glideTo(to, reduce() ? 0 : 200);
    e.moved = Math.abs(to - e.y0) > 8;
  }
  // Only the keyboard arriving, changing height or the screen turning places the field again. Safari's toolbar
  // also resizes the window while the member scrolls, and that must never pull the page.
  let vvWait = 0;
  let size = `${innerWidth}x${innerHeight}`;
  let keyboardAt: number | null = null;
  const resized = () => {
    clearTimeout(vvWait);
    vvWait = window.setTimeout(() => {
      const turned = innerWidth !== Number(size.split("x")[0]);
      size = `${innerWidth}x${innerHeight}`;
      const at = keyboardUp() ? Math.round(view().height) : null;
      if (!turned && at === keyboardAt) return;
      keyboardAt = at;
      measure();
      if (turned || at !== null) settled();
    }, 150);
  };

  let backFrame = 0;
  let backStill = 0;
  const pill = () => $<HTMLButtonElement>(".back");
  function placeBack(b: HTMLElement) {
    const vv = visualViewport;
    // fixed elements sit in the layout area iOS slides under the keyboard, so above it the pill is placed by hand
    if (vv && keyboardUp()) {
      b.style.top = `${vv.offsetTop + vv.height - b.offsetHeight - 12}px`;
      b.style.bottom = "auto";
    } else {
      b.style.top = "";
      b.style.bottom = "";
    }
    const column = $(".groups")!.getBoundingClientRect();
    b.style.left = `${column.left + column.width / 2}px`;
  }
  let backWait = 0;
  function showBack(on: boolean) {
    clearTimeout(backWait);
    const b = pill();
    if (!b) return;
    root.classList.toggle("backing", on);
    if (!on) return b.removeAttribute("data-on");
    placeBack(b);
    b.setAttribute("data-on", "");
  }
  function checkBack() {
    cancelAnimationFrame(backFrame);
    backFrame = requestAnimationFrame(() => {
      const b = pill();
      if (!b) return;
      if (!ed || !ed.free) return showBack(false);
      const v = view();
      const r = ed.sec.getBoundingClientRect();
      const seen = Math.min(r.bottom, v.bottom) - Math.max(r.top, v.top + under());
      const on = b.hasAttribute("data-on");
      b.dataset.dir = r.top >= v.bottom ? "down" : "up";
      // it waits a moment off screen, so a fling past the group doesn't pop it in and out
      if (!on && seen <= 0) {
        if (!backWait) {
          backWait = window.setTimeout(() => {
            backWait = 0;
            const g = ed?.free ? ed.sec.getBoundingClientRect() : null;
            const w = view();
            if (g && Math.min(g.bottom, w.bottom) - Math.max(g.top, w.top + under()) <= 0)
              showBack(true);
          }, 150);
        }
      } else if (!on) {
        clearTimeout(backWait);
        backWait = 0;
      } else if (seen >= 48) showBack(false);
      else placeBack(b);
    });
  }
  const scrolled = () => {
    checkBack();
    const b = pill();
    if (!b?.hasAttribute("data-on") || !keyboardUp()) return;
    b.setAttribute("data-moving", "");
    clearTimeout(backStill);
    backStill = window.setTimeout(() => {
      b.removeAttribute("data-moving");
      placeBack(b);
    }, 150);
  };
  // Back to the whole group from its heading when it fits above the keyboard, or else to the field with Save under it.
  function goBack() {
    const e = ed;
    if (!e) return;
    showBack(false);
    const z = zone();
    const head = e.sec.getBoundingClientRect().top - z.edge - ZONE_TOP;
    const fits =
      form().getBoundingClientRect().bottom - e.sec.getBoundingClientRect().top <=
      z.bottom - z.edge - ZONE_TOP;
    const field = e.last && form().contains(e.last) ? e.last : (e.target ?? $(".f", form())!);
    // while the member is typing, the field they left comes back above the keyboard
    const writing = typing() && form().contains(document.activeElement);
    const top = fits && !writing ? scrollY + head : targetFor(e, field, keyboardUp());
    if (top != null) glideTo(top, T().open);
    if (!writing) $(".gh h2", e.sec)?.focus({ preventScroll: true });
  }

  const unsaved = () => !!ed && (ed.busy || dirty() || !!res.busy);

  function openDom(gid: Gid, key: string, draft?: Draft) {
    const sub = gid === "career" ? (key === "resume" || key === "book" ? "res" : "lnk") : null;
    const eid = (sub ?? gid) as Eid;
    const base = editors[eid].draft();
    ed = {
      gid,
      key,
      eid,
      sec: $(`#g-${gid}`)!,
      draft: draft ?? base,
      base: snap(base),
      before: deps.rows(gid),
      shown: new Set(),
      asking: false,
      error: null,
      busy: false,
      saving: false,
      labelAt: 0,
      last: null,
      next: null,
      after: null,
      target: null,
      y0: scrollY,
      moved: false,
      free: false,
    };
    Object.assign(res, {
      confirm: false,
      busy: null,
      error: null,
      book: null,
      bookLabel: null,
      bookError: null,
    });
    root.classList.add("editing");
    showBack(false);
    commit();
    return $(editors[eid].focus[key] ?? ".f", ed.sec) ?? $(".f", ed.sec)!;
  }

  function closeDom() {
    const { gid, before } = ed!;
    ed = null;
    showBack(false);
    root.classList.remove("editing");
    commit();
    const after = deps.rows(gid);
    return after.filter((r, i) => r.value !== before[i]?.value).map((r) => r.key);
  }

  function open(gid: Gid, key: string, from?: HTMLElement | null) {
    const y0 = scrollY;
    from ??= $(`#g-${gid} [data-row="${key}"]`);
    from?.classList.add("press");
    const marks = from && {
      v: mid($(".v", from)!),
      k: $(".k", from)!.getBoundingClientRect().top,
    };
    let target!: HTMLElement;
    let rank: (el: Element, i: number) => number = (_, i) => i;
    const plan = choreograph(
      () => {
        const prev = ed?.sec;
        if (ed) closeDom();
        target = openDom(gid, key);
        const e = ed!;
        const f = form();
        if (prev && prev !== e.sec) {
          for (const r of $$(".gp > *", prev)) {
            anim(r, [{ opacity: 0 }, { opacity: 1 }], {
              duration: T().fadeIn,
              delay: reduce() ? 0 : 50,
              easing: APPEAR,
            });
          }
        }
        const kb = coarse && target.matches("input:not([type=file])");
        const kids = $$(":scope > *", f);
        const at = kids.findIndex((k) => k.contains(target));
        const bar = act();
        // The tapped field arrives first, its neighbours after it.
        rank = (_, i) => Math.abs(i - Math.max(at, 0));
        const block = target.closest(".f") ?? $(".f", f)!;
        const c = control(block);
        const pin: Pin | undefined = marks
          ? c
            ? { sec: e.sec, el: c, mid: true, from: marks.v }
            : { sec: e.sec, el: $(":scope > .k", block) ?? block, mid: false, from: marks.k }
          : undefined;
        return {
          top: targetFor(e, target, kb, pin),
          pin,
          solid: c ? block : null,
          after: (dur, clips) => {
            // Save's row travels with the panel's growing edge, so the edge never slices it.
            const edge = clips.get(e.sec);
            const b = bar.getBoundingClientRect().bottom;
            if (dur && edge != null && b > edge) {
              anim(bar, [{ transform: `translateY(${edge - b}px)` }, { transform: "none" }], {
                duration: dur,
                easing: MOVE,
              });
            }
          },
          enter: kids,
        };
      },
      {
        swap: [...new Set([$(`#g-${gid}`)!, ...$$(".grp.open")])],
        enterOrder: (el, i) => rank(el, i),
        blank: from,
      },
    );
    Object.assign(ed!, { y0, moved: Math.abs((plan.top ?? scrollY) - y0) > 8, target });
    // A select focused inside the tap can pop its menu mid-glide, so it waits for the glide.
    if (coarse && target.matches("select")) {
      setTimeout(() => ed?.target === target && target.focus({ preventScroll: true }), T().open);
    } else if (coarse && target.matches("input:not([type=file])")) {
      focusVia(target as HTMLInputElement, T().open);
    } else if (target.matches(":disabled, .f")) {
      $(".gh h2", ed!.sec)?.focus({ preventScroll: true });
    } else target.focus({ preventScroll: true });
  }

  function close(saved = false) {
    const e = ed!;
    const { key, sec, y0, moved, free } = e;
    const f = form();
    const field = $(E(e).focus[key] ?? ".f", sec)?.closest(".f") ?? $(".f", f)!;
    const c = control(field);
    const fr = field.getBoundingClientRect();
    const pinFrom = c ? mid(c) : ($(":scope > .k", field) ?? field).getBoundingClientRect().top;
    const v = view();
    const edge = v.top + under();
    const box = sec.getBoundingClientRect();
    const side = $(".side")!;
    const s = side.getBoundingClientRect();
    // Go back only if the open moved the page and the member hasn't moved it since.
    const back = moved && !free;
    // Once the member has scrolled the field away, closing leaves what they are looking at where it is: the answers
    // below a group above the view hold still, unless that would slide the card's column beside them.
    const still = free && (fr.bottom <= edge + titleH() || fr.top >= v.bottom);
    const hold =
      box.top < edge &&
      (s.bottom <= edge || s.top >= v.bottom || getComputedStyle(side).position === "sticky");
    let changed: string[] = [];
    choreograph(
      () => {
        changed = closeDom();
        const rowEl = $(`[data-row="${key}"]`, sec)!;
        if (still) {
          if (hold) window.scrollBy(0, sec.getBoundingClientRect().bottom - box.bottom);
          return { closing: true, enter: $$(".gp > *", sec) };
        }
        const top = back
          ? y0
          : scrollY +
            rowEl.getBoundingClientRect().top -
            Math.min(Math.max(fr.top, edge + ZONE_TOP), v.top + innerHeight - 96);
        return {
          top,
          closing: true,
          enter: $$(".gp > *", sec),
          solid: c ? rowEl : null,
          pin: { sec, el: $(c ? ".v" : ".k", rowEl)!, mid: !!c, from: pinFrom },
        };
      },
      { swap: [sec], blank: c },
    );
    // A save always says so, even when the row's text can't change.
    if (saved && !changed.length) changed = [key];
    changed.forEach((k, i) =>
      setTimeout(() => flash($(`[data-row="${k}"] .ok`, sec)), T().close * 0.6 + i * 40),
    );
    $(`[data-row="${key}"]`, sec)?.focus({ preventScroll: true });
  }

  // "Saved" arrives as the row settles, holds, then leaves more slowly than it came.
  function flash(ok: HTMLElement | null) {
    if (!ok) return;
    ok.hidden = false;
    ok.animate(
      [
        { opacity: 0, transform: reduce() ? "none" : "translateX(-6px)" },
        { opacity: 1, transform: "none" },
      ],
      { duration: reduce() ? 120 : 200, easing: APPEAR, fill: "backwards" },
    );
    setTimeout(
      () =>
        ok
          .animate([{ opacity: 1 }, { opacity: 0 }], {
            duration: 400,
            easing: "ease-in",
            fill: "forwards",
          })
          .finished.then(
            () => {
              ok.hidden = true;
              ok.getAnimations().forEach((a) => a.cancel());
            },
            () => {},
          ),
      2800,
    );
  }

  function announce(text: string) {
    const s = $("#you-status");
    if (!s) return;
    s.textContent = "";
    setTimeout(() => (s.textContent = text), 50);
  }

  const dirty = () => !!ed && !E(ed).instant && snap(ed.draft) !== ed.base;

  // After a failed Save the page moves only as far as it must: the first problem from its question down to Save when
  // that fits, or else down to its message, which sits under the answers; when even that is too tall, the message
  // stays in view and the question gives way.
  function errorTop(el: Element) {
    const z = zone(el, coarse && el.matches("input"));
    const r = el.closest(".f")!.getBoundingClientRect();
    const hi = r.top - z.top;
    const save = act().getBoundingClientRect().bottom - z.bottom;
    const lo = save <= hi ? save : r.bottom - z.bottom;
    const d = lo <= hi ? Math.min(Math.max(0, lo), hi) : lo;
    return Math.abs(d) < 1 ? null : scrollY + d;
  }

  // A message that opens above where the member went next makes its room by moving the page, so what they are on stays
  // put, as far as that can go without lifting the message itself out of view.
  function holdTop(el: Element, was: number, added: Element[]) {
    const now = el.getBoundingClientRect().top;
    const d = now - was;
    if (d < 1) return null;
    const m = added.find((x) => x.getBoundingClientRect().bottom <= now);
    const s = m ? Math.min(d, Math.max(0, m.getBoundingClientRect().top - zone().top)) : d;
    return s < 1 ? null : scrollY + s;
  }

  // An error appears on blur or Save and leaves as soon as the value is fixed; typing never adds one.
  function showErrors(
    add: string[] = [],
    focusEl: Element | null = null,
    went: Element | null = null,
  ) {
    const e = ed!;
    const errs = E(e).check(e.draft);
    const next = new Set([...e.shown, ...add].filter((k) => errs[k]));
    if (next.size === e.shown.size && [...next].every((k) => e.shown.has(k))) {
      e.shown = next;
      return commit();
    }
    const f = form();
    const before = new Set($$(".f > .err:not([hidden])", f));
    const was = went && f.contains(went) ? went.getBoundingClientRect().top : null;
    const plan = choreograph(
      () => {
        e.shown = next;
        commit();
        const enter = $$(".f > .err:not([hidden])", f).filter((x) => !before.has(x));
        return {
          top: focusEl ? errorTop(focusEl) : was != null ? holdTop(went!, was, enter) : null,
          enter,
        };
      },
      { track: $$(".f, .act", f) },
    );
    if (plan.top != null) e.moved = Math.abs(plan.top - e.y0) > 8;
  }

  async function save() {
    const e = ed;
    if (!e || e.busy) return;
    const next = e.after;
    e.after = null;
    const errors = E(e).check(e.draft);
    const bad = Object.keys(errors);
    if (bad.length) {
      const el = $(`[data-k="${bad[0]}"]`, form()) ?? $(`[data-chips="${bad[0]}"] .chip`, form());
      showErrors(bad, el);
      // A field reads its own error when it takes focus; a choice in a set of chips doesn't.
      if (!el?.matches("[data-k]")) announce(errors[bad[0]!]!);
      return el?.focus({ preventScroll: true });
    }
    if (!dirty()) return close();
    busy(true);
    let failure: unknown = null;
    try {
      await deps.save(e.eid, e.draft);
    } catch (caught) {
      failure = caught ?? FAILED;
    }
    if (ed !== e) return;
    // Once "Saving…" shows, it stays long enough to read.
    if (e.labelAt) await sleep(Math.max(0, e.labelAt + 400 - performance.now()));
    if (ed !== e) return;
    if (failure) {
      busy(false);
      choreograph(
        () => {
          e.error = message(failure);
          commit();
          return { enter: [$(".act .err", form())!] };
        },
        { track: $$(".f, .act .fa", form()) },
      );
      return;
    }
    announce(`${deps.title(e.gid)} saved.`);
    close(true);
    // "Save changes" from the question after tapping another row: that row opens once this one has saved.
    if (next) open(next.gid, next.key);
  }

  // "Saving…" only shows for a save slow enough to notice, so a quick one never flickers.
  let slowLabel = 0;
  function busy(on: boolean) {
    const e = ed!;
    e.busy = on;
    e.labelAt = 0;
    e.saving = false;
    clearTimeout(slowLabel);
    if (on) {
      e.error = null;
      slowLabel = window.setTimeout(() => {
        if (ed !== e) return;
        e.saving = true;
        e.labelAt = performance.now();
        commit();
      }, BUSY_AFTER);
    }
    commit();
  }

  // The whole group when it fits on screen, or else the question with the first changed field above it.
  function askTop() {
    const e = ed!;
    const z = zone();
    const a = act();
    const s = e.sec.getBoundingClientRect();
    const r = a.getBoundingClientRect();
    if (s.top >= z.edge && r.bottom <= z.bottom) return null;
    if (r.bottom - s.top <= z.bottom - z.edge - ZONE_TOP)
      return scrollY + s.top - z.edge - ZONE_TOP;
    const base = new Map(JSON.parse(e.base) as [string, string][]);
    const f =
      $$(".f", form()).find((x) =>
        x.dataset.keys!.split(" ").some((k) => flat(e.draft[k]) !== base.get(k)),
      ) ?? a;
    const lo = r.bottom - z.bottom;
    const hi = Math.min(f.getBoundingClientRect().top, r.top) - z.top;
    const d = lo <= hi ? Math.min(Math.max(0, lo), hi) : lo;
    return Math.abs(d) < 1 ? null : scrollY + d;
  }

  // Leaving a changed editor asks first; `next` is the row the member tapped, if any. The question stays once asked;
  // asking again only brings it back into view.
  function ask(next: Next | null = null) {
    const e = ed!;
    e.next = next;
    if (!e.asking) {
      choreograph(
        () => {
          e.asking = true;
          commit();
          return { top: askTop(), enter: [act()] };
        },
        { track: $$(".f", form()) },
      );
    } else {
      const top = askTop();
      if (top != null) glideTo(top, T().open);
    }
    $("[data-act=keep]", form())?.focus({ preventScroll: true });
  }

  function unask() {
    const e = ed!;
    e.next = null;
    choreograph(
      () => {
        e.asking = false;
        commit();
        return { enter: [act()] };
      },
      { track: $$(".f", form()) },
    );
  }

  function keep() {
    const e = ed!;
    unask();
    (e.last && form().contains(e.last) ? e.last : $(E(e).focus[e.key] ?? ".f", e.sec))?.focus({
      preventScroll: true,
    });
  }

  function dismiss() {
    if (!ed || ed.busy || res.busy) return;
    if (res.confirm) return actions["rm-no"]!();
    if (ed.asking) return keep();
    if (dirty()) return ask();
    close();
  }

  function paintRes(focus?: string) {
    commit();
    if (focus && ed) $(focus, form())?.focus({ preventScroll: true });
  }

  async function upload(file: File | undefined) {
    const e = ed;
    if (!file || !e) return;
    Object.assign(res, { busy: "upload", error: null });
    paintRes("#replace");
    const failure = await deps.upload(file);
    if (ed !== e) return;
    Object.assign(res, { busy: null, error: failure });
    paintRes("#replace");
    if (failure) return announce(failure);
    flash($(".file .ok", form()));
    announce("Resume saved.");
  }

  async function removeResume() {
    res.busy = "remove";
    paintRes("[data-act=rm-yes]");
    try {
      await deps.removeResume();
      Object.assign(res, { confirm: false, busy: null, error: null });
      paintRes("#replace");
      announce("Resume removed. You're out of the resume book.");
    } catch (failure) {
      Object.assign(res, { busy: null, error: message(failure) });
      paintRes("[data-act=rm-yes]");
      announce(message(failure));
    }
  }

  // The resume book saves the moment it's switched, and says so: "Saving…" after 150ms, then "Saved", or the old
  // answer back with an error.
  async function toggleBook(v: "in" | "out") {
    if (!deps.hasResume() || res.book || (v === "in") === deps.inBook()) return;
    Object.assign(res, { book: v, bookLabel: null, bookError: null });
    commit();
    let shownAt = 0;
    const slow = setTimeout(() => {
      res.bookLabel = "saving";
      shownAt = performance.now();
      commit();
    }, BUSY_AFTER);
    let failure: unknown = null;
    try {
      await deps.setBook(v === "in");
    } catch (caught) {
      failure = caught ?? FAILED;
    }
    clearTimeout(slow);
    if (shownAt) await sleep(Math.max(0, shownAt + 400 - performance.now()));
    res.book = null;
    if (failure) {
      Object.assign(res, {
        bookLabel: null,
        bookError: "We couldn't change that. Check your connection and try again.",
      });
      commit();
      announce("We couldn't change the resume book. Check your connection and try again.");
      return $(`[data-chips="book"] [data-v="${v}"]`)?.focus({ preventScroll: true });
    }
    res.bookLabel = "saved";
    commit();
    if (ed) flash($(".bk .ok", form()));
    announce(v === "in" ? "You're in the resume book." : "You're out of the resume book.");
  }

  const actions: Record<string, () => void> = {
    cancel: () => close(),
    done: () => close(),
    keep,
    discard: () => (ed?.next ? open(ed.next.gid, ed.next.key) : close()),
    save: () => {
      const next = ed!.next;
      unask();
      $("[type=submit]", form())?.focus({ preventScroll: true });
      ed!.after = next;
      void save();
    },
    upload: () => void (res.busy || $<HTMLInputElement>("#resume-file")?.click()),
    rm: () => {
      res.confirm = true;
      paintRes("[data-act=rm-no]");
    },
    "rm-no": () => {
      res.confirm = false;
      paintRes("[data-act=rm]");
    },
    "rm-yes": () => void (res.busy || removeResume()),
  };

  // A blur message waits for the pointer to lift, so it can't push Save out from under a click.
  let down = false;
  let later: (() => void) | null = null;
  let pointerType = "mouse";
  let pressedAt = { x: 0, y: 0 };

  const listeners: [EventTarget, string, EventListener, AddEventListenerOptions?][] = [
    [
      document,
      "pointerdown",
      ((e: PointerEvent) => {
        down = true;
        pointerType = e.pointerType;
        pressedAt = { x: e.clientX, y: e.clientY };
        root.classList.add("pointer");
        // A press on the scrollbar is the member moving the page.
        if (e.target === document.documentElement) released();
      }) as EventListener,
    ],
    [document, "keydown", () => root.classList.remove("pointer"), { capture: true }],
    [
      document,
      "pointerup",
      () =>
        setTimeout(() => {
          down = false;
          later?.();
          later = null;
        }),
    ],
    [document, "pointercancel", () => (down = false)],
    // Cancel and Save don't take focus from the field, so the keyboard stays up through a save and leaves with the close.
    [
      document,
      "mousedown",
      (e) => {
        if ((e.target as Element).closest?.(".act .fa button, .back")) e.preventDefault();
      },
    ],
    // A touch takes the page back from a glide at once. iOS also shows :active only when a touch listener exists.
    [document, "touchstart", stopGlide, { passive: true }],
    [document, "touchmove", released, { passive: true }],
    [document, "wheel", released, { passive: true }],
    [
      document,
      "click",
      ((e: MouseEvent) => {
        const t = e.target as Element;
        if (t.closest(".back")) return goBack();
        const rowEl = t.closest<HTMLElement>("button.row");
        // Every other row stays live: a clean editor hands over in one motion, a changed one asks first.
        if (rowEl && root.contains(rowEl) && !(ed && form().contains(rowEl))) {
          const gid = rowEl.closest(".grp")!.id.slice(2) as Gid;
          const key = rowEl.dataset.row!;
          if (!ed) return open(gid, key, rowEl);
          if (ed.busy) return;
          return dirty() ? ask({ gid, key }) : open(gid, key, rowEl);
        }
        if (!ed) return;
        const a = t.closest<HTMLElement>("[data-act]");
        if (a && form().contains(a)) return actions[a.dataset.act!]?.();
        const chip = t.closest<HTMLElement>(".chip");
        if (chip && form().contains(chip)) {
          if (ed.busy) return;
          const k = chip.parentElement!.dataset.chips!;
          const v = chip.dataset.v!;
          if (k === "book") return void toggleBook(v as "in" | "out");
          E(ed).toggle?.(k, v, ed.draft);
          if (ed.asking) keep();
          return showErrors();
        }
        // With a mouse, a click outside the editor leaves a clean one and asks about a changed one. The card and the
        // section titles are only looked at, so a click there does neither.
        if (
          pointerType === "mouse" &&
          !ed.sec.contains(t) &&
          !t.closest("a, button, input, select, label, .cf-host, .gh, .kick") &&
          !ed.busy
        ) {
          if (dirty()) ask();
          else close();
        }
      }) as EventListener,
    ],
    [
      document,
      "keydown",
      ((e: KeyboardEvent) => {
        if (e.key === "Escape" && ed) {
          e.preventDefault();
          return dismiss();
        }
        const t = e.target as HTMLElement;
        // A key that scrolled the page is the member moving it; whether one does depends on the control and the browser.
        if (SCROLL_KEYS.has(e.key)) {
          const y = scrollY;
          requestAnimationFrame(() => requestAnimationFrame(() => scrollY !== y && released()));
        }
        // Return moves on to the next field. On the last, a phone's keyboard closes, as Safari's own check above it
        // does, and only Save saves; a computer's Return still saves.
        if (e.key === "Enter" && ed && t.matches("input[data-k]") && form().contains(t)) {
          if (t.enterKeyHint === "next") {
            e.preventDefault();
            const all = $$("input[data-k]", form());
            return all[all.indexOf(t) + 1]?.focus();
          }
          if (coarse) {
            e.preventDefault();
            return t.blur();
          }
        }
        // Arrow keys move the choice inside a radio group, as native radios do.
        const c = t.closest?.<HTMLElement>("[role=radio]");
        const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        if (!c || !step) return;
        e.preventDefault();
        const all = $$("[role=radio]:not(:disabled)", c.parentElement!);
        const n = all[(all.indexOf(c) + step + all.length) % all.length]!;
        n.focus();
        n.click();
      }) as EventListener,
    ],
    [
      document,
      "input",
      (e) => {
        const t = e.target as HTMLInputElement;
        if (!ed || !t.dataset.k || !form().contains(t)) return;
        const k = t.dataset.k;
        // A save in flight keeps what it is saving; a select can't be made read-only, so it is put back.
        if (ed.busy) return void (t.value = String(ed.draft[k] ?? ""));
        const prev = ed.draft[k];
        ed.draft[k] = t.value;
        const focus = E(ed).change?.(k, ed.draft, prev);
        if (ed.asking) keep();
        showErrors();
        if (focus) $(focus, form())?.focus();
      },
    ],
    [
      document,
      "change",
      (e) => {
        const t = e.target as HTMLInputElement;
        if (ed && t.id === "resume-file") {
          void upload(t.files?.[0]);
          t.value = "";
        }
      },
    ],
    [
      document,
      "focusin",
      (e) => {
        const t = e.target as HTMLElement;
        if (ed && form().contains(t) && t.dataset.k) ed.last = t;
        root.classList.toggle("typing", typing());
      },
    ],
    [document, "focusout", () => queueMicrotask(() => root.classList.toggle("typing", typing()))],
    [
      document,
      "focusout",
      (e) => {
        const t = e.target as HTMLElement;
        if (!ed || !t.dataset?.k || !form().contains(t)) return;
        const k = t.dataset.k;
        const at = ed;
        // Safari doesn't focus a pressed button, so what was pressed is found where the pointer went down.
        const went = (e as FocusEvent).relatedTarget as Element | null;
        if (down)
          later = () =>
            ed === at &&
            showErrors([k], null, went ?? document.elementFromPoint(pressedAt.x, pressedAt.y));
        // A field removed while focused blurs inside React's own render, which can't take another one.
        else queueMicrotask(() => ed === at && showErrors([k], null, went));
      },
    ],
    [
      document,
      "submit",
      (e) => {
        if (!ed || !form().contains(e.target as Node)) return;
        e.preventDefault();
        void save();
      },
    ],
    [window, "resize", resized],
    [window, "scroll", scrolled, { passive: true }],
  ];

  return {
    state: () => ({ ed, res }),
    unsaved,
    start() {
      document.body.append(probe, standIn);
      for (const [target, type, fn, options] of listeners)
        target.addEventListener(type, fn, options);
      visualViewport?.addEventListener("resize", resized);
      visualViewport?.addEventListener("resize", scrolled);
      visualViewport?.addEventListener("scroll", scrolled);
    },
    stop() {
      for (const [target, type, fn, options] of listeners) {
        target.removeEventListener(type, fn, options);
      }
      visualViewport?.removeEventListener("resize", resized);
      visualViewport?.removeEventListener("resize", scrolled);
      visualViewport?.removeEventListener("scroll", scrolled);
      cancelAnimationFrame(backFrame);
      clearTimeout(backStill);
      clearTimeout(backWait);
      clearTimeout(vvWait);
      clearTimeout(slowLabel);
      stopGlide();
      clearTimeout(handoff);
      probe.remove();
      standIn.remove();
      for (const a of running) a.cancel();
      // A save or upload still in flight finds no editor when it lands, so it can't steer a page that has gone.
      ed = null;
    },
  };
}
