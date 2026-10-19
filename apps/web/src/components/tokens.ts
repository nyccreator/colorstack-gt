const TICK = 2000;
const FIRST = 600;
const SHRINK_MS = 400;
const POP = "cubic-bezier(.16,.55,.3,1)";
const OUT = "cubic-bezier(0,0,.58,1)";
const SETTLE =
  "linear(0,0.058,0.199,0.382,0.574,0.751,0.898,1.009,1.084,1.125,1.14,1.135,1.117,1.092,1.065,1.039,1.018,1.001,0.99,0.983,0.98,0.981,0.983,0.986,0.99,0.994,0.997,0.999,1.001,1.002,1.003,1,1.002,1.002,1.001,1.001,1.001,1,1,1,1)";
const SHRINK =
  "linear(0,0.045,0.15,0.283,0.421,0.551,0.664,0.76,0.836,0.895,0.938,0.969,0.99,1.003,1.011,1.014,1.015,1.014,1.013,1.011,1.009,1.007,1.005,1.004,1.002,1.002,1.001,1,1,1,1,1,1)";

type Token = {
  el: HTMLElement;
  art: HTMLElement;
  templates: HTMLElement[];
  cur: HTMLElement | null;
  idx: number;
  cycles: boolean;
  visible: boolean;
  bare: boolean;
  scope: Scope;
};

type Scope = { tokens: Token[]; next: number; ticked: boolean; timer: number };

export type Tokens = {
  hand: (scene: HTMLElement, t: number) => void;
  settle: () => void;
  stop: () => void;
};

const number = (value: string, fallback: number) => {
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const tilt = (el: HTMLElement) =>
  Math.sign(number(getComputedStyle(el).getPropertyValue("--r"), 0));

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const EASING_SAMPLES = 120;
const cssEasing = (easing: string) => {
  let table: number[] | undefined;
  return (x: number) => {
    if (!table) {
      const clock = new Animation(
        new KeyframeEffect(null, null, { duration: 1, easing, fill: "both" }),
      );
      table = Array.from({ length: EASING_SAMPLES + 1 }, (_, i) => {
        clock.currentTime = i / EASING_SAMPLES;
        return clock.effect?.getComputedTiming().progress ?? i / EASING_SAMPLES;
      });
      clock.cancel();
    }
    const at = Math.min(1, Math.max(0, x)) * EASING_SAMPLES;
    const i = Math.min(EASING_SAMPLES - 1, Math.floor(at));
    return lerp(table[i]!, table[i + 1]!, at - i);
  };
};
const pop = cssEasing(POP);
const settle = cssEasing(SETTLE);
const out = cssEasing(OUT);
const shrink = cssEasing(SHRINK);

const frames = new WeakMap<HTMLElement, number>();

function halt(el: HTMLElement) {
  cancelAnimationFrame(frames.get(el) ?? 0);
  frames.delete(el);
}

// Icons move from script, not an animation, because iPhone Safari gives an animating element a layer that paints frames late.
function play(el: HTMLElement, ms: number, draw: (at: number) => void, done: () => void) {
  halt(el);
  const t0 = performance.now();
  const tick = () => {
    const at = performance.now() - t0;
    draw(Math.min(at, ms));
    if (at < ms) frames.set(el, requestAnimationFrame(tick));
    else {
      frames.delete(el);
      done();
    }
  };
  tick();
}

function pose(el: HTMLElement, rotate: number, scale: number, opacity: number) {
  el.style.rotate = `${rotate}deg`;
  el.style.scale = String(scale);
  el.style.opacity = String(opacity);
}

function rest(el: HTMLElement) {
  el.style.removeProperty("rotate");
  el.style.removeProperty("scale");
  el.style.removeProperty("opacity");
}

function enter(el: HTMLElement) {
  const s = tilt(el);
  halt(el);
  play(
    el,
    600,
    (at) => {
      const t = at / 600;
      const fade = out(Math.min(1, at / 180));
      if (t < 2 / 3) {
        const k = pop(t * 1.5);
        pose(el, lerp(-16 * s, 5 * s, k), lerp(0.4, 1.2, k), fade);
      } else {
        const k = settle((t - 2 / 3) * 3);
        pose(el, lerp(5 * s, 0, k), lerp(1.2, 1, k), fade);
      }
    },
    () => rest(el),
  );
}

function retire(el: HTMLElement) {
  halt(el);
  rest(el);
  if (el.dataset.clone) el.remove();
  else el.style.visibility = "hidden";
}

function leave(el: HTMLElement) {
  const style = getComputedStyle(el);
  const s = tilt(el);
  const scale = number(style.getPropertyValue("scale"), 1);
  const rotate = number(style.getPropertyValue("rotate"), 0);
  const opacity = number(style.opacity, 1);
  halt(el);
  play(
    el,
    SHRINK_MS,
    (at) => {
      const k = out(Math.min(1, at / 200));
      pose(
        el,
        lerp(rotate, 5 * s, k),
        lerp(scale, 0.5, shrink(at / SHRINK_MS)),
        lerp(opacity, 0, k),
      );
    },
    () => retire(el),
  );
}

export function startTokens(root: HTMLElement): Tokens {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const scopes = new Map<Element, Scope>();
  const tokens = new Map<HTMLElement, Token>();
  const waits = new WeakMap<HTMLElement, number>();

  const seen = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const token = tokens.get(entry.target as HTMLElement);
      if (!token) continue;
      const back = entry.isIntersecting && !token.visible;
      token.visible = entry.isIntersecting;
      if (back) arm(token.scope);
    }
  });

  const show = (token: Token, idx: number) => {
    const old = token.cur;
    const template = token.templates[idx];
    if (!template) return;
    const el = template.cloneNode(true) as HTMLElement;
    el.classList.add("on");
    token.art.appendChild(el);
    token.cur = el;
    token.idx = idx;
    if (reduce.matches) {
      if (old && old !== el) {
        play(
          old,
          120,
          (at) => (old.style.opacity = String(1 - out(at / 120))),
          () => retire(old),
        );
      }
      play(
        el,
        120,
        (at) => (el.style.opacity = String(out(at / 120))),
        () => rest(el),
      );
      return;
    }
    if (old) leave(old);
    enter(el);
  };

  const arm = (scope: Scope) => {
    clearTimeout(scope.timer);
    scope.timer = 0;
    if (reduce.matches || document.hidden || !scope.tokens.length) return;
    scope.timer = window.setTimeout(
      () => {
        const count = scope.tokens.length;
        for (let k = 0; k < count; k++) {
          const token = scope.tokens[(scope.next + k) % count];
          if (!token || !token.visible || token.bare) continue;
          scope.next = (scope.next + k + 1) % count;
          scope.ticked = true;
          show(token, (token.idx + 1) % token.templates.length);
          break;
        }
        arm(scope);
      },
      scope.ticked ? TICK : FIRST,
    );
  };

  for (const el of root.querySelectorAll<HTMLElement>(".tk")) {
    const art = el.querySelector<HTMLElement>(".tk-art");
    const pics = art ? [...art.querySelectorAll<HTMLElement>(".tk-pic")] : [];
    if (!art || !pics.length) continue;
    const host = el.closest("[data-scene]") ?? root;
    let scope = scopes.get(host);
    if (!scope) {
      scope = { tokens: [], next: 0, ticked: false, timer: 0 };
      scopes.set(host, scope);
    }
    const cur = pics.find((pic) => pic.classList.contains("on")) ?? pics[0] ?? null;
    const token: Token = {
      el,
      art,
      cur,
      idx: cur ? pics.indexOf(cur) : 0,
      cycles: el.dataset.cycle !== undefined && pics.length > 1,
      visible: false,
      bare: false,
      scope,
      templates: pics.map((pic) => {
        const copy = pic.cloneNode(true) as HTMLElement;
        copy.classList.remove("on");
        copy.dataset.clone = "1";
        return copy;
      }),
    };
    tokens.set(el, token);
    if (token.cycles) {
      scope.tokens.push(token);
      seen.observe(el);
    }
  }

  for (const scope of scopes.values()) arm(scope);

  const activate = (el: HTMLElement) => {
    const token = tokens.get(el);
    if (!token || token.bare) return;
    if (!token.cycles) {
      show(token, token.idx);
      return;
    }
    show(token, (token.idx + 1) % token.templates.length);
    const scope = token.scope;
    scope.next = (scope.tokens.indexOf(token) + 1) % scope.tokens.length;
    scope.ticked = true;
    arm(scope);
  };

  const onClick = (event: MouseEvent) => {
    const el = (event.target as Element | null)?.closest<HTMLElement>(".tk");
    if (el && root.contains(el)) activate(el);
  };

  const onKey = (event: KeyboardEvent) => {
    const el = event.target as HTMLElement | null;
    if ((event.key === "Enter" || event.key === " ") && el?.matches('.tk[role="button"]')) {
      event.preventDefault();
      activate(el);
    }
  };

  const onWake = () => {
    for (const scope of scopes.values()) arm(scope);
  };

  const bare = (token: Token) => {
    token.bare = true;
    token.el.classList.add("bare");
    token.el.tabIndex = -1;
    token.el.setAttribute("aria-disabled", "true");
    const old = token.cur;
    token.cur = null;
    if (old) {
      if (reduce.matches) retire(old);
      else leave(old);
    }
  };

  const dress = (token: Token) => {
    token.bare = false;
    token.el.classList.remove("bare");
    token.el.tabIndex = 0;
    token.el.removeAttribute("aria-disabled");
    const template = token.templates[token.idx];
    if (!template) return;
    const el = template.cloneNode(true) as HTMLElement;
    el.classList.add("on");
    token.art.appendChild(el);
    token.cur = el;
    if (token.cycles) arm(token.scope);
    if (reduce.matches) return;
    el.style.visibility = "hidden";
    setTimeout(() => {
      if (token.cur !== el) return;
      el.style.visibility = "";
      enter(el);
    }, 120);
  };

  root.addEventListener("click", onClick);
  root.addEventListener("keydown", onKey);
  document.addEventListener("visibilitychange", onWake);
  reduce.addEventListener("change", onWake);

  return {
    hand(scene, t) {
      const tag = scene.querySelector<HTMLElement>(".tag .tk");
      const token = tag ? tokens.get(tag) : undefined;
      if (token) {
        if (t > 0.08 && !token.bare) bare(token);
        else if (t < 0.04 && token.bare) dress(token);
      }
      const bottom = scene.getBoundingClientRect().bottom;
      let order = 0;
      for (const sticker of scene.querySelectorAll<HTMLElement>(".it-st")) {
        if (t <= 0.05) {
          sticker.dataset.shown = "";
          sticker.style.visibility = "hidden";
          clearTimeout(waits.get(sticker));
          continue;
        }
        if (sticker.dataset.shown) continue;
        const box = sticker.getBoundingClientRect();
        if (!box.height || box.bottom > bottom - 2) continue;
        sticker.dataset.shown = "1";
        waits.set(
          sticker,
          window.setTimeout(() => {
            sticker.style.visibility = "";
            if (!reduce.matches) enter(sticker);
          }, order++ * 80),
        );
      }
    },
    settle() {
      for (const sticker of root.querySelectorAll<HTMLElement>(".it-st")) {
        sticker.dataset.shown = "";
        sticker.style.visibility = "";
      }
      for (const token of tokens.values()) if (token.bare) dress(token);
    },
    stop() {
      seen.disconnect();
      for (const scope of scopes.values()) clearTimeout(scope.timer);
      root.removeEventListener("click", onClick);
      root.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onWake);
      reduce.removeEventListener("change", onWake);
    },
  };
}
