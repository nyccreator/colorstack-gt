import { type Group, GROUPS } from "@colorstack-gt/backend/convex/lib/groups";
import { MESSAGES } from "@colorstack-gt/backend/convex/lib/messages";
import { flushSync } from "react-dom";

import { APPEAR, BUSY_AFTER, cue, LABEL_HOLD, MOVE, still } from "@/lib/motion";

import { announce as say } from "../frame";
import {
  type Draft,
  type Field,
  FIELDS,
  errorsFor,
  failureText,
  setField,
  toggleField,
  type Upload,
} from "../member/draft";
import { type Editor, GROUP_OF, TITLES } from "../member/groups";

type Resume = { name: string; size: number };
export type Row = { key: string; label: string; value: string; fixed?: boolean; editor: Editor };
type Next = { group: Group; key: string };

export type EditorDef = {
  focus: Partial<Record<string, string>>;
  fields: readonly Field[];
  change?: (k: Field, d: Draft, prev: Draft) => { patch?: Partial<Draft>; focus?: string } | void;
  chips?: boolean;
  instant?: boolean;
};

export type Ed = {
  group: Group;
  editor: Editor;
  key: string;
  sec: HTMLElement;
  draft: Draft;
  base: Draft;
  before: Row[];
  shown: Set<string>;
  asking: boolean;
  error: string | null;
  busy: boolean;
  saving: boolean;
  last: HTMLElement | null;
  next: Next | null;
  target: HTMLElement | null;
  y0: number;
  moved: boolean;
  userScrolled: boolean;
};

export type Res = {
  confirm: boolean;
  busy: "upload" | "remove" | null;
  slow: boolean;
  error: string | null;
  uploaded: Resume | null;
  book: "in" | "out" | null;
  bookLabel: "saving" | "saved" | null;
  bookError: string | null;
};

export type Deps = {
  rows: (group: Group) => Row[];
  editors: Record<Editor, EditorDef>;
  draft: () => Draft;
  save: (editor: Editor, d: Draft) => Promise<unknown>;
  setBook: (on: boolean) => Promise<unknown>;
  upload: (file: File) => Promise<Upload>;
  removeResume: () => Promise<unknown>;
  resume: () => Resume | undefined;
  inBook: () => boolean;
};

type Snapshot = { ed: Ed | null; res: Res; lastOpen: Group };

type Plan = {
  top?: number | null;
  closing?: boolean;
  pin?: Pin;
  solid?: Element | null;
  order?: (i: number) => number;
  enter?: Element[];
};
type Pin = { sec: HTMLElement; el: Element; by: "center" | "top"; from: number; delta?: number };

const ZONE_TOP = 16;
const RING_ROOM = 8;
const SCROLL_KEYS = new Set([" ", "PageUp", "PageDown", "Home", "End", "ArrowUp", "ArrowDown"]);
const VISIBLE = "you-visible";
const ALL_FIELDS = new Set<string>(Object.values(FIELDS).flat());
const isField = (k: string): k is Field => ALL_FIELDS.has(k);
const isGroup = (id: string): id is Group => (GROUPS as readonly string[]).includes(id);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function slowLabel(show: () => void) {
  let shownAt = 0;
  const timer = setTimeout(() => {
    shownAt = performance.now();
    show();
  }, BUSY_AFTER);
  return () => {
    clearTimeout(timer);
    return shownAt ? sleep(shownAt + LABEL_HOLD - performance.now()) : null;
  };
}

const [x1, y1, x2, y2] = MOVE.match(/[\d.]+/g)!.map(Number) as [number, number, number, number];
const moveEase = (x: number) => {
  const at = (t: number, p1: number, p2: number) =>
    3 * p1 * t * (1 - t) ** 2 + 3 * p2 * t * t * (1 - t) + t ** 3;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (at(mid, x1, x2) < x) lo = mid;
    else hi = mid;
  }
  return at((lo + hi) / 2, y1, y2);
};
const unordered = (v: Draft[Field]) => JSON.stringify(Array.isArray(v) ? [...v].sort() : v);
const same = (a: Draft, b: Draft, k: Field) => unordered(a[k]) === unordered(b[k]);

export type Editing = ReturnType<typeof createEditing>;

export function createEditing(deps: Deps) {
  let root: HTMLElement;
  const $ = <T extends Element = HTMLElement>(s: string, el: ParentNode = root) =>
    el.querySelector<T>(s);
  const $$ = <T extends Element = HTMLElement>(s: string, el: ParentNode = root) => [
    ...el.querySelectorAll<T>(s),
  ];
  const coarse = matchMedia("(pointer: coarse)").matches;
  const reduce = still;
  const { editors } = deps;

  let version = 0;
  const listeners = new Set<() => void>();
  // Rendering inside flushSync lets a close fold the mutation's new rows into the same commit as the editor leaving.
  const emit = () => {
    version++;
    flushSync(() => listeners.forEach((fn) => fn()));
  };

  let ed: Ed | null = null;
  let lastOpen: Group = "name";
  const res: Res = {
    confirm: false,
    busy: null,
    slow: false,
    error: null,
    uploaded: null,
    book: null,
    bookLabel: null,
    bookError: null,
  };
  const E = (e: Ed) => editors[e.editor];
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
  // Animated elements copy their current opacity and transform, so a change mid-fade doesn't flash.
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

  function choreograph(
    change: () => Plan | void,
    {
      swap = [],
      track = [],
      blank,
    }: {
      swap?: Element[];
      track?: Element[];
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
    const dur = reduce() ? 0 : plan.closing ? t.close : t.open;
    const moved = new Map<Element, number>();
    const pin = plan.pin;
    for (const el of blocks) {
      if (!el.isConnected) continue;
      let dy = first.get(el)! - anchor(el);
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
    // The heading's row moves and only the heading scales, so the pinned row's fade travels with the text.
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
      const act = $(".act", g.sec);
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
      const top = Math.max(0, d);
      const bot = Math.max(0, h - d - g.h);
      if (dur && (top || bot)) {
        anim(
          gp,
          [
            { clipPath: `inset(${top}px -${RING_ROOM}px ${bot}px -${RING_ROOM}px round 24px)` },
            { clipPath: `inset(0 -${RING_ROOM}px 0 -${RING_ROOM}px round 0)` },
          ],
          { duration: dur, easing: MOVE },
        );
      }
      const clipBottom = gp.getBoundingClientRect().top + h - bot;
      const saveBottom = act?.getBoundingClientRect().bottom ?? 0;
      if (dur && act && saveBottom > clipBottom) {
        anim(
          act,
          [{ transform: `translateY(${clipBottom - saveBottom}px)` }, { transform: "none" }],
          {
            duration: dur,
            easing: MOVE,
          },
        );
      }
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
    (plan.enter ?? []).forEach((el, i) => {
      const o = {
        duration: t.fadeIn,
        delay: (reduce() ? 0 : 30) + Math.min(plan.order?.(i) ?? i, 4) * t.stagger,
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
      // Only the label fades in, because WebKit hides the caret of a field that is fading.
      const k = $(":scope > .k", el);
      if (k) anim(k, [{ opacity: 0 }, { opacity: 1 }], o);
    });
    // The scroll glides on the transforms' curve because iOS paints a script scroll a frame before the transforms
    // that hide it.
    if (plan.top != null) glideTo(plan.top, dur);
    const gen = ++generation;
    Promise.allSettled(running.map((a) => a.finished)).then(() => {
      if (gen === generation) document.documentElement.style.overflowAnchor = "";
    });
    return plan;
  }

  const centerY = (el: Element) => {
    const r = el.getBoundingClientRect();
    return r.top + r.height / 2;
  };
  const control = (block: Element) => $("input:not([type=file]), select", block);
  const pinY = (p: Pin) => (p.by === "center" ? centerY(p.el) : p.el.getBoundingClientRect().top);

  const typing = () =>
    coarse && !!document.activeElement?.matches("input:not([type=file]):not([readonly])");
  // iOS slides fixed elements with the keyboard, so a fixed probe plus visualViewport.offsetTop finds the visible
  // top in the coordinates rects use.
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
  const fixedBarHeight = () => {
    const b = $(".bar");
    return b && getComputedStyle(b).position === "fixed" ? b.offsetHeight : 0;
  };

  // Safari's toolbar changes innerHeight but not the visible height above a keyboard, so that height is what's
  // remembered.
  let visibleAbove: Record<string, number> = {};
  try {
    visibleAbove = JSON.parse(localStorage.getItem(VISIBLE) ?? "{}") ?? {};
  } catch {}
  const kindOf = (el: Element | null) =>
    `${el?.matches("[type=tel], [inputmode=numeric], [inputmode=decimal]") ? "num" : "text"}:${innerWidth > innerHeight ? "l" : "p"}`;
  const visibleWith = (el: Element) =>
    visibleAbove[kindOf(el)] ??
    Math.round((innerWidth > innerHeight ? innerHeight : screen.height) * 0.45);
  function measure() {
    const vv = visualViewport;
    if (!vv || !keyboardUp() || Math.abs(vv.scale - 1) > 0.01) return;
    visibleAbove[kindOf(document.activeElement)] = Math.round(vv.height);
    try {
      localStorage.setItem(VISIBLE, JSON.stringify(visibleAbove));
    } catch {}
  }

  // Phones scroll natively because a script-driven scroll stalls while the keyboard opens.
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
      window.scrollTo(0, from + (top - from) * moveEase(p));
      if (p < 1) glide = requestAnimationFrame(step);
    };
    glide = requestAnimationFrame(step);
  }
  const stopGlide = () => cancelAnimationFrame(glide);
  const userScrolls = () => {
    stopGlide();
    if (ed) ed.userScrolled = true;
    checkBack();
  };

  // iOS opens the keyboard only for a focus inside the tap and then scrolls that field into view itself, so the tap
  // focuses a stand-in and focus moves to the real field after the glide.
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

  // The heading's height counts only while you.css has it sticky, which a phone keyboard undoes.
  const titleH = (kb = false) => {
    const gh = $(".grp.open .gh");
    return gh && !kb && getComputedStyle(gh).position === "sticky" ? gh.offsetHeight : 0;
  };
  type Zone = { top: number; bottom: number; edge: number };
  const zone = (focusEl?: Element, kb = false): Zone => {
    const v = view();
    const keyboardComing = kb && focusEl && v.height >= innerHeight - 80;
    const bottom = keyboardComing ? v.top + visibleWith(focusEl) : v.bottom;
    const edge = v.top + fixedBarHeight();
    return { top: edge + ZONE_TOP + titleH(kb), bottom: bottom - (narrow() ? 8 : 24), edge };
  };
  const toScroll = (d: number) => (Math.abs(d) < 1 ? null : scrollY + d);
  const reveal = (topRoom: number, bottomOverflow: number) =>
    toScroll(
      bottomOverflow <= topRoom ? Math.min(Math.max(0, bottomOverflow), topRoom) : bottomOverflow,
    );
  function scrollFor(f: HTMLElement, block: Element, z: Zone, want = 0) {
    const first = block === $(".f", f);
    const toField = (first ? f : block).getBoundingClientRect().top - z.top;
    const toSave = f.parentElement!.getBoundingClientRect().bottom - z.bottom;
    const least = toSave <= toField ? toSave : block.getBoundingClientRect().bottom - z.bottom;
    if (least > toField) return toField;
    const toHeading = f.closest(".grp")!.getBoundingClientRect().top - z.edge;
    const most = toHeading >= ZONE_TOP ? Math.min(toField, toHeading - ZONE_TOP) : toField;
    return Math.min(Math.max(want, least), most >= least ? most : toField);
  }
  function targetFor(e: Ed, focusEl: Element, kb: boolean, pin?: Pin) {
    const f = $<HTMLFormElement>("form", e.sec)!;
    const z = zone(focusEl, kb);
    if (narrow() && !kb && E(e).chips) {
      const head = e.sec.getBoundingClientRect().top;
      const fr = f.getBoundingClientRect();
      const top = z.edge + ZONE_TOP;
      const groupFits = fr.bottom - head <= z.bottom - top;
      return toScroll(groupFits ? head - top : fr.top - z.top);
    }
    const block = focusEl.closest(".f") ?? $(".f", f)!;
    return toScroll(scrollFor(f, block, z, pin ? pinY(pin) - pin.from : 0));
  }

  function refit() {
    if (!ed || ed.userScrolled) return;
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
  // Safari's toolbar resizes the window as the member scrolls, so only a turn or a new keyboard height may move the
  // page.
  let vvWait = 0;
  let width = innerWidth;
  let keyboardAt: number | null = null;
  const resized = () => {
    clearTimeout(vvWait);
    vvWait = window.setTimeout(() => {
      const turned = innerWidth !== width;
      width = innerWidth;
      const at = keyboardUp() ? Math.round(view().height) : null;
      if (!turned && at === keyboardAt) return;
      keyboardAt = at;
      measure();
      if (turned || at !== null) refit();
    }, 150);
  };

  let backFrame = 0;
  let backStill = 0;
  const pill = () => $<HTMLButtonElement>(".back");
  function placeBack(b: HTMLElement) {
    const vv = visualViewport;
    // iOS slides fixed elements behind the keyboard, so while it is up the pill is placed from the visual viewport.
    if (vv && keyboardUp()) {
      b.style.top = `${vv.offsetTop + vv.height - b.offsetHeight - 12}px`;
      b.style.bottom = "auto";
    } else {
      b.style.top = "";
      b.style.bottom = "";
    }
  }
  let backWait = 0;
  function showBack(on: boolean) {
    clearTimeout(backWait);
    const b = pill();
    if (!b) return;
    if (!on) return b.removeAttribute("data-on");
    placeBack(b);
    b.setAttribute("data-on", "");
  }
  function checkBack() {
    cancelAnimationFrame(backFrame);
    backFrame = requestAnimationFrame(() => {
      const b = pill();
      if (!b) return;
      if (!ed || !ed.userScrolled) return showBack(false);
      const v = view();
      const r = ed.sec.getBoundingClientRect();
      const seen = Math.min(r.bottom, v.bottom) - Math.max(r.top, v.top + fixedBarHeight());
      const on = b.hasAttribute("data-on");
      b.dataset.dir = r.top >= v.bottom ? "down" : "up";
      // The pill waits a moment so a fling past the group doesn't flash it.
      if (!on && seen <= 0) {
        if (!backWait) {
          backWait = window.setTimeout(() => {
            backWait = 0;
            const g = ed?.userScrolled ? ed.sec.getBoundingClientRect() : null;
            const w = view();
            if (g && Math.min(g.bottom, w.bottom) - Math.max(g.top, w.top + fixedBarHeight()) <= 0)
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
    const writing = typing() && form().contains(document.activeElement);
    const top = fits && !writing ? scrollY + head : targetFor(e, field, keyboardUp());
    if (top != null) glideTo(top, T().open);
    if (!writing) $(".gh h2", e.sec)?.focus({ preventScroll: true });
  }

  const unsaved = () => !!ed && (ed.busy || dirty() || !!res.busy || !!res.book);

  function openDom(group: Group, key: string) {
    const before = deps.rows(group);
    const base = deps.draft();
    ed = {
      group,
      editor: before.find((r) => r.key === key)!.editor,
      key,
      sec: $(`#g-${group}`)!,
      draft: base,
      base,
      before,
      shown: new Set(),
      asking: false,
      error: null,
      busy: false,
      saving: false,
      last: null,
      next: null,
      target: null,
      y0: scrollY,
      moved: false,
      userScrolled: false,
    };
    lastOpen = group;
    shownErrors = "";
    Object.assign(res, {
      confirm: false,
      busy: null,
      slow: false,
      error: null,
      uploaded: null,
      book: null,
      bookLabel: null,
      bookError: null,
    });
    showBack(false);
    emit();
    return $(E(ed).focus[key] ?? ".f", ed.sec) ?? $(".f", ed.sec)!;
  }

  function closeDom(saved = false) {
    const { group, before, key } = ed!;
    ed = null;
    showBack(false);
    emit();
    const after = deps.rows(group);
    const changed = after.filter((r, i) => r.value !== before[i]?.value).map((r) => r.key);
    return saved && !changed.length ? [key] : changed;
  }

  function tick(sec: HTMLElement, keys: string[]) {
    keys.forEach((k, i) =>
      setTimeout(() => flash($(`[data-row="${k}"] .ok`, sec)), T().close * 0.6 + i * 40),
    );
  }

  function open(group: Group, key: string, from?: HTMLElement | null, saved = false) {
    const y0 = scrollY;
    from ??= $(`#g-${group} [data-row="${key}"]`);
    from?.classList.add("press");
    const marks = from && {
      v: centerY($(".v", from)!),
      k: $(".k", from)!.getBoundingClientRect().top,
    };
    let target!: HTMLElement;
    const plan = choreograph(
      () => {
        const prev = ed?.sec;
        if (prev) {
          const changed = closeDom(saved);
          if (saved) tick(prev, changed);
        }
        target = openDom(group, key);
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
        const tapped = Math.max(
          kids.findIndex((k) => k.contains(target)),
          0,
        );
        const block = target.closest(".f") ?? $(".f", f)!;
        const c = control(block);
        const pin: Pin | undefined = marks
          ? c
            ? { sec: e.sec, el: c, by: "center", from: marks.v }
            : { sec: e.sec, el: $(":scope > .k", block) ?? block, by: "top", from: marks.k }
          : undefined;
        return {
          top: targetFor(e, target, kb, pin),
          pin,
          solid: c ? block : null,
          order: (i) => Math.abs(i - tapped),
          enter: kids,
        };
      },
      {
        swap: [...new Set([$(`#g-${group}`)!, ...$$(".grp.open")])],
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
    const { key, sec, y0, moved, userScrolled } = e;
    const f = form();
    const field = $(E(e).focus[key] ?? ".f", sec)?.closest(".f") ?? $(".f", f)!;
    const c = control(field);
    const fr = field.getBoundingClientRect();
    const pinFrom = c ? centerY(c) : ($(":scope > .k", field) ?? field).getBoundingClientRect().top;
    const v = view();
    const edge = v.top + fixedBarHeight();
    const box = sec.getBoundingClientRect();
    const side = $(".side")!;
    const column = side.getBoundingClientRect();
    const restore = moved && !userScrolled;
    const fieldGone = userScrolled && (fr.bottom <= edge + titleH() || fr.top >= v.bottom);
    const keepBelowStill =
      box.top < edge &&
      (column.bottom <= edge ||
        column.top >= v.bottom ||
        getComputedStyle(side).position === "sticky");
    let changed: string[] = [];
    choreograph(
      () => {
        changed = closeDom(saved);
        const rowEl = $(`[data-row="${key}"]`, sec)!;
        if (fieldGone) {
          if (keepBelowStill) window.scrollBy(0, sec.getBoundingClientRect().bottom - box.bottom);
          return { closing: true, enter: $$(".gp > *", sec) };
        }
        const top = restore
          ? y0
          : scrollY +
            rowEl.getBoundingClientRect().top -
            Math.min(Math.max(fr.top, edge + ZONE_TOP), v.top + innerHeight - 96);
        return {
          top,
          closing: true,
          enter: $$(".gp > *", sec),
          solid: c ? rowEl : null,
          pin: { sec, el: $(c ? ".v" : ".k", rowEl)!, by: c ? "center" : "top", from: pinFrom },
        };
      },
      { swap: [sec], blank: c },
    );
    tick(sec, changed);
    $(`[data-row="${key}"]`, sec)?.focus({ preventScroll: true });
  }

  function flash(ok: HTMLElement | null) {
    if (!ok) return;
    ok.hidden = false;
    cue(ok, () => {
      ok.hidden = true;
      ok.getAnimations().forEach((a) => a.cancel());
      const chev = ok.parentElement?.querySelector<HTMLElement>(":scope > .chev");
      if (chev)
        chev.animate([{ opacity: 0 }, { opacity: getComputedStyle(chev).opacity }], {
          duration: reduce() ? 120 : 200,
          easing: APPEAR,
        });
    });
  }

  const announce = (text: string) => say("you-status", text);

  const fields = (e: Ed) => FIELDS[GROUP_OF[e.editor]];
  const dirty = () =>
    !!ed && !E(ed).instant && !fields(ed).every((k) => same(ed!.draft, ed!.base, k));

  function errorTop(el: Element) {
    const z = zone(el, coarse && el.matches("input"));
    const question = el.closest(".f")!.getBoundingClientRect();
    const toQuestion = question.top - z.top;
    const toSave = act().getBoundingClientRect().bottom - z.bottom;
    return reveal(toQuestion, toSave <= toQuestion ? toSave : question.bottom - z.bottom);
  }

  function holdTop(el: Element, was: number, added: Element[]) {
    const now = el.getBoundingClientRect().top;
    const d = now - was;
    if (d < 1) return null;
    const m = added.find((x) => x.getBoundingClientRect().bottom <= now);
    return toScroll(m ? Math.min(d, Math.max(0, m.getBoundingClientRect().top - zone().top)) : d);
  }

  let shownErrors = "";
  function showErrors(
    add: string[] = [],
    focusEl: Element | null = null,
    went: Element | null = null,
  ): boolean {
    const e = ed!;
    const errs: Partial<Record<string, string>> = errorsFor(E(e).fields, e.draft);
    const next = new Set([...e.shown, ...add].filter((k) => errs[k]));
    const text = [...next]
      .sort()
      .map((k) => `${k}: ${errs[k]}`)
      .join("\n");
    if (text === shownErrors) {
      e.shown = next;
      return false;
    }
    shownErrors = text;
    const f = form();
    const before = new Set($$(".f > .err:not([hidden])", f));
    const was = went && f.contains(went) ? went.getBoundingClientRect().top : null;
    const plan = choreograph(
      () => {
        e.shown = next;
        emit();
        const enter = $$(".f > .err:not([hidden])", f).filter((x) => !before.has(x));
        return {
          top: focusEl ? errorTop(focusEl) : was != null ? holdTop(went!, was, enter) : null,
          enter,
        };
      },
      { track: $$(".f, .act", f) },
    );
    if (plan.top != null) e.moved = Math.abs(plan.top - e.y0) > 8;
    return true;
  }

  async function save(next: Next | null = null) {
    const e = ed;
    if (!e || e.busy) return;
    const bad = Object.entries(errorsFor(E(e).fields, e.draft)).filter(([, text]) => text);
    if (bad[0]) {
      const [k, text] = bad[0];
      const el = $(`[data-k="${k}"]`, form()) ?? $(`[data-chips="${k}"] .chip`, form());
      showErrors(
        bad.map(([k]) => k),
        el,
      );
      // Chips aren't described by their error the way a field is, so the error is announced.
      if (!el?.matches("[data-k]")) announce(text!);
      return el?.focus({ preventScroll: true });
    }
    if (!dirty()) return close();
    Object.assign(e, { busy: true, error: null });
    const settle = slowLabel(() => {
      if (ed !== e) return;
      e.saving = true;
      emit();
    });
    emit();
    let failure: unknown = null;
    try {
      await deps.save(e.editor, e.draft);
    } catch (caught) {
      failure = caught ?? MESSAGES.failed;
    }
    if (ed !== e) return;
    const hold = settle();
    if (hold) await hold;
    if (ed !== e) return;
    if (failure) {
      Object.assign(e, { busy: false, saving: false });
      emit();
      choreograph(
        () => {
          e.error = failureText(failure);
          emit();
          return { enter: [$(".act .err", form())!] };
        },
        { track: $$(".f, .act .fa", form()) },
      );
      return;
    }
    announce(`${TITLES[e.group]} saved.`);
    if (next) open(next.group, next.key, null, true);
    else close(true);
  }

  function askTop() {
    const e = ed!;
    const z = zone();
    const a = act();
    const group = e.sec.getBoundingClientRect();
    const question = a.getBoundingClientRect();
    if (group.top >= z.edge && question.bottom <= z.bottom) return null;
    const groupFits = question.bottom - group.top <= z.bottom - z.edge - ZONE_TOP;
    if (groupFits) return scrollY + group.top - z.edge - ZONE_TOP;
    const changed: string[] = fields(e).filter((k) => !same(e.draft, e.base, k));
    const firstChanged =
      $$(".f", form()).find((x) => x.dataset.keys!.split(" ").some((k) => changed.includes(k))) ??
      a;
    return reveal(
      Math.min(firstChanged.getBoundingClientRect().top, question.top) - z.top,
      question.bottom - z.bottom,
    );
  }

  function ask(next: Next | null = null) {
    const e = ed!;
    e.next = next;
    if (!e.asking) {
      choreograph(
        () => {
          e.asking = true;
          emit();
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
        emit();
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
    emit();
    if (focus && ed) $(focus, form())?.focus({ preventScroll: true });
  }

  function paintResMoving(enter: string, focus?: string) {
    choreograph(
      () => {
        emit();
        return { enter: $$(enter, form()) };
      },
      { track: $$(".f, .act", form()) },
    );
    if (focus && ed) $(focus, form())?.focus({ preventScroll: true });
  }

  const slowRes = (e: Ed | null) =>
    slowLabel(() => {
      if (ed !== e) return;
      res.slow = true;
      emit();
    });

  // The resume actions finish only in the editor they started in; a reopened one has its own `res`.
  async function upload(file: File | undefined) {
    const e = ed;
    if (!file || !e) return;
    Object.assign(res, { busy: "upload", error: null });
    paintRes("#replace");
    const settle = slowRes(e);
    const result = await deps.upload(file);
    const hold = settle();
    if (hold) await hold;
    if (ed !== e) return;
    Object.assign(res, { busy: null, slow: false });
    if (!result.ok) {
      res.error = result.error;
      paintResMoving('[data-keys="resume"] > .err', "#replace");
      return announce(result.error);
    }
    res.uploaded = result.resume;
    paintRes("#replace");
    flash($(".file .ok", form()));
    announce("Resume saved.");
  }

  async function removeResume() {
    const e = ed;
    res.busy = "remove";
    paintRes("[data-act=rm-yes]");
    const settle = slowRes(e);
    let failure: unknown = null;
    try {
      await deps.removeResume();
    } catch (caught) {
      failure = caught ?? MESSAGES.failed;
    }
    const hold = settle();
    if (hold) await hold;
    if (ed !== e) return;
    Object.assign(res, { busy: null, slow: false });
    if (failure) {
      res.error = failureText(failure);
      paintResMoving('[data-keys="resume"] > .err', "[data-act=rm-yes]");
      return announce(res.error);
    }
    Object.assign(res, { confirm: false, error: null, uploaded: null });
    paintResMoving('[data-keys="resume"] .fa', "#replace");
    announce("Resume removed. You're out of the resume book.");
  }

  async function toggleBook(on: boolean) {
    const e = ed;
    if (!(res.uploaded ?? deps.resume()) || res.book || on === deps.inBook()) return;
    Object.assign(res, { book: on ? "in" : "out", bookLabel: null, bookError: null });
    emit();
    const settle = slowLabel(() => {
      if (ed !== e) return;
      res.bookLabel = "saving";
      emit();
    });
    let failure: unknown = null;
    try {
      await deps.setBook(on);
    } catch (caught) {
      failure = caught ?? MESSAGES.failed;
    }
    const hold = settle();
    if (hold) await hold;
    if (ed !== e) return;
    res.book = null;
    if (failure) {
      Object.assign(res, {
        bookLabel: null,
        bookError: "We couldn't change that. Check your connection and try again.",
      });
      paintResMoving('[data-keys="book"] > .err');
      announce("We couldn't change the resume book. Check your connection and try again.");
      return $(`[data-chips="book"] [data-v="${on ? "in" : "out"}"]`)?.focus({
        preventScroll: true,
      });
    }
    res.bookLabel = "saved";
    emit();
    if (ed) flash($(".bk .ok", form()));
    announce(on ? "You're in the resume book." : "You're out of the resume book.");
  }

  const actions: Record<string, () => void> = {
    cancel: () => close(),
    done: () => void (res.busy || close()),
    keep,
    discard: () => (ed?.next ? open(ed.next.group, ed.next.key) : close()),
    save: () => {
      const next = ed!.next;
      unask();
      $("[type=submit]", form())?.focus({ preventScroll: true });
      void save(next);
    },
    upload: () => void (res.busy || $<HTMLInputElement>("#resume-file")?.click()),
    rm: () => {
      res.confirm = true;
      paintResMoving(".confirm", "[data-act=rm-no]");
    },
    "rm-no": () => {
      res.confirm = false;
      paintResMoving('[data-keys="resume"] .fa', "[data-act=rm]");
    },
    "rm-yes": () => void (res.busy || removeResume()),
  };

  // A blur message waits for the pointer to lift, so it can't push Save out from under a click.
  let down = false;
  let later: (() => void) | null = null;
  let pointerType = "mouse";
  let pressedAt = { x: 0, y: 0 };

  const handlers: [EventTarget, string, EventListener, AddEventListenerOptions?][] = [
    [
      document,
      "pointerdown",
      ((e: PointerEvent) => {
        down = true;
        pointerType = e.pointerType;
        pressedAt = { x: e.clientX, y: e.clientY };
        root.classList.add("pointer");
        // A press on the scrollbar is the member moving the page.
        if (e.target === document.documentElement) userScrolls();
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
    [
      document,
      "pointercancel",
      () => {
        down = false;
        later = null;
      },
    ],
    // The editor's buttons and the Back pill don't take focus from the field, so the keyboard stays up through a
    // save.
    [
      document,
      "mousedown",
      (e) => {
        if ((e.target as Element).closest?.(".act .fa button, .back")) e.preventDefault();
      },
    ],
    // iOS applies :active only when a touch listener exists, so this one also serves every button.
    [document, "touchstart", stopGlide, { passive: true }],
    [document, "touchmove", userScrolls, { passive: true }],
    [document, "wheel", userScrolls, { passive: true }],
    [
      document,
      "click",
      ((e: MouseEvent) => {
        const t = e.target as Element;
        if (t.closest(".back")) return goBack();
        const rowEl = t.closest<HTMLElement>("button.row");
        if (rowEl && root.contains(rowEl) && !(ed && form().contains(rowEl))) {
          const group = rowEl.closest<HTMLElement>(".grp")!.id.slice(2);
          const key = rowEl.dataset.row!;
          if (!isGroup(group)) return;
          if (!ed) return open(group, key, rowEl);
          if (ed.busy) return;
          return dirty() ? ask({ group, key }) : open(group, key, rowEl);
        }
        if (!ed) return;
        const a = t.closest<HTMLElement>("[data-act]");
        if (a && form().contains(a)) return actions[a.dataset.act!]?.();
        const chip = t.closest<HTMLElement>(".chip");
        if (chip && form().contains(chip)) {
          if (ed.busy) return;
          const k = chip.parentElement!.dataset.chips!;
          const v = chip.dataset.v!;
          if (k === "book") return void toggleBook(v === "in");
          const patch = toggleField(ed.draft, k, v);
          if (patch) ed.draft = { ...ed.draft, ...patch };
          if (ed.asking) keep();
          if (!showErrors()) emit();
          return;
        }
        if (
          pointerType === "mouse" &&
          !ed.sec.contains(t) &&
          !t.closest("a, button, input, select, label, .cf-host, .gh, .kick") &&
          !ed.busy &&
          !res.busy
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
        // Space and the arrow keys scroll only for some controls and browsers, so check whether the page moved.
        if (SCROLL_KEYS.has(e.key)) {
          const y = scrollY;
          requestAnimationFrame(() => requestAnimationFrame(() => scrollY !== y && userScrolls()));
        }
        // On a phone the last field's Return only closes the keyboard, like Safari's check above it, and Save is what
        // saves.
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
        const t = e.target as HTMLInputElement | HTMLSelectElement;
        const k = t.dataset.k;
        if (!ed || !k || !isField(k) || !form().contains(t)) return;
        // A select can't be read-only like the text fields, so a change during a save is put back.
        if (ed.busy) return void (t.value = String(ed.draft[k]));
        const prev = ed.draft;
        const patch = setField(prev, k, t.value);
        if (!patch) return;
        ed.draft = { ...prev, ...patch };
        const more = E(ed).change?.(k, ed.draft, prev);
        if (more?.patch) ed.draft = { ...ed.draft, ...more.patch };
        if (ed.asking) keep();
        // Text fields are uncontrolled, so only a select or a changed message has anything to render.
        if (!showErrors() && (t.matches("select") || more?.patch)) emit();
        if (more?.focus) $(more.focus, form())?.focus();
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
      },
    ],
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
        // A field removed while focused blurs inside React's commit, where flushSync can't run, so this waits a
        // microtask.
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

  let ac = new AbortController();

  return {
    subscribe: (fn: () => void) => {
      listeners.add(fn);
      return () => void listeners.delete(fn);
    },
    version: () => version,
    state: (): Snapshot => ({ ed, res, lastOpen }),
    unsaved,
    start(el: HTMLElement) {
      root = el;
      ac = new AbortController();
      const { signal } = ac;
      document.body.append(probe, standIn);
      for (const [target, type, fn, options] of handlers)
        target.addEventListener(type, fn, { ...options, signal });
      visualViewport?.addEventListener("resize", resized, { signal });
      visualViewport?.addEventListener("resize", scrolled, { signal });
      visualViewport?.addEventListener("scroll", scrolled, { signal });
    },
    stop() {
      ac.abort();
      cancelAnimationFrame(backFrame);
      clearTimeout(backStill);
      clearTimeout(backWait);
      clearTimeout(vvWait);
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
