import alea from "alea";
import { curveBasisClosed, lineRadial } from "d3-shape";
import { useEffect, useRef } from "react";

import type { Profile } from "@/lib/member";

const W = 440;
const H = 277;
const TAU = Math.PI * 2;
const f = (v: number) => +v.toFixed(2);

type Palette = { navy: string; lift: string; cream: string; burdell: string };
type Stops = [number, number][];

const unit = (hex: string) =>
  [1, 3, 5].map((i) => (parseInt(hex.slice(i, i + 2), 16) / 255).toFixed(4));

function settings(no: number) {
  const r = alea(`navy:${no}`);
  return {
    cx: W * (0.74 + 0.04 * r()),
    cy: H * (0.42 + 0.08 * r()),
    lobes: 10 + Math.floor(3 * r()),
    twist: ((18 + 10 * r()) * Math.PI) / 180,
    beat: 0.15 + 0.25 * r(),
    beatAt: r() * TAU,
    phase: r() * TAU,
  };
}

// Capping each lobe's slope stops the inner rings catching the light together and drawing spokes.
function relief(s: ReturnType<typeof settings>) {
  const count = 33,
    inner = 10,
    gap = 6.5,
    grow = 0.3,
    amp = 5.5,
    steep = 40,
    square = 0.08,
    wide = 0.03,
    sx = 1.25;
  const n = 6,
    P = s.lobes * n,
    lift = 3 / (2 + Math.cos(TAU / n)),
    M = 8;
  const off = (q: number[]) =>
    Math.max(q[0]!, q[2]!, q[4]!, q[6]!) < -M ||
    Math.min(q[0]!, q[2]!, q[4]!, q[6]!) > W + M ||
    Math.max(q[1]!, q[3]!, q[5]!, q[7]!) < -M ||
    Math.min(q[1]!, q[3]!, q[5]!, q[7]!) > H + M;
  const X = (x: number) => f(x * sx + s.cx);
  const Y = (y: number) => f(y / sx + s.cy);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const t = Math.min(i / 23, 1.4);
    const R = inner + gap * (i + (grow * i * i) / (2 * Math.max(1, count - 1)));
    const ph = s.phase + i * s.twist;
    const a0 = Math.min(
      amp,
      (Math.tan((steep * Math.PI) / 180) * R) / (lift * s.lobes * (1 + s.beat)),
    );
    const pts: [number, number][] = [];
    for (let k = 0; k < P; k++) {
      const a = (k / P) * TAU;
      const shape = R * (1 + square * t * Math.cos(4 * a) - wide * t * Math.cos(2 * a));
      pts.push([
        a,
        shape + a0 * lift * Math.sin(s.lobes * a + ph) * (1 + s.beat * Math.cos(a - s.beatAt)),
      ]);
    }
    let d = "";
    let at = [0, 0];
    let pen: number[] | null = null;
    const pathContext = {
      moveTo: (x: number, y: number) => {
        at = [X(x), Y(y)];
      },
      lineTo: () => {},
      bezierCurveTo: (x1: number, y1: number, x2: number, y2: number, x: number, y: number) => {
        const c = [X(x1), Y(y1), X(x2), Y(y2), X(x), Y(y)];
        if (!off([...at, ...c])) {
          if (!pen || pen[0] !== at[0] || pen[1] !== at[1]) d += `M${at.join(" ")}`;
          d += `C${c.join(" ")}`;
          pen = [c[4]!, c[5]!];
        }
        at = [c[4]!, c[5]!];
      },
      closePath: () => {},
    };
    lineRadial()
      .curve(curveBasisClosed)
      .context(pathContext as unknown as CanvasRenderingContext2D)(pts);
    out.push(d);
  }
  return out;
}

// Every gradient and RELIEF.az assume this one light, so move them together.
const KEY = { x: 26, y: 0, rx: 506, ry: 318 };
const REACH = { ...KEY, ry: 250 };
const SPARKLE: Stops = [
  [0, 1],
  [0.35, 0.5],
  [0.65, 0],
];
const LIFT: Stops = [
  [0, 0.9],
  [0.35, 0.76],
  [0.7, 0.52],
  [1, 0.38],
];
const DEEP: Stops = [
  [0.5, 0],
  [1, 0.45],
];
const WALLS: Stops = [
  [0, 1],
  [0.4, 0.95],
  [0.75, 0.45],
  [1, 0.18],
];
const FADE: Stops = [
  [0.12, 0.04],
  [0.42, 0.3],
  [0.66, 1],
];
const RELIEF = { az: 225, el: 50, depth: 2.4, blur: 0.7, w: 1.2, tail: 5 };
const NOISE = 7.13;

const radial = (id: string, color: string, stops: Stops, k = KEY) =>
  `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" gradientTransform="translate(${k.x} ${k.y}) scale(${k.rx} ${k.ry})">${stops.map(([o, a]) => `<stop offset="${o}" stop-color="${color}" stop-opacity="${a}"/>`).join("")}</radialGradient>`;
const rect = (fill: string, extra = "") =>
  `<rect x="-8" y="-8" width="${W + 16}" height="${H + 16}" fill="${fill}"${extra}/>`;
const tint = (c: string, k: number, at: number) => {
  const [r, g, b] = unit(c);
  return `0 0 0 0 ${r} 0 0 0 0 ${g} 0 0 0 0 ${b} ${k} 0 0 0 ${(-k * at).toFixed(3)}`;
};
const speck = (id: string, seed: number, c: string, k: number, at: number) =>
  `<filter id="${id}" filterUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="${NOISE}" numOctaves="3" seed="${seed}"/><feColorMatrix values="${tint(c, k, at)}"/></filter>`;

function art(no: number, C: Palette) {
  const id = `cf${no}`;
  const s = settings(no);
  const R = RELIEF;
  const flat = Math.sin((R.el * Math.PI) / 180);
  const [hr, hg, hb] = unit(C.cream);
  const [lr, lg, lb] = unit(C.navy);
  const [fr, fg, fb] = unit(C.burdell);
  const box = `maskUnits="userSpaceOnUse" x="-8" y="-8" width="${W + 16}" height="${H + 16}"`;
  const fade = `<linearGradient id="${id}x" gradientUnits="userSpaceOnUse" x1="0" x2="${W}" y1="0" y2="0">${FADE.map(([o, a]) => `<stop offset="${o}" stop-color="white" stop-opacity="${a}"/>`).join("")}</linearGradient>`;
  const area = `filterUnits="userSpaceOnUse" x="-8" y="-8" width="${W + 16}" height="${H + 16}" color-interpolation-filters="sRGB"`;
  const eng = (fid: string, matrix: string) =>
    `<filter id="${fid}" ${area}><feGaussianBlur in="SourceAlpha" stdDeviation="${R.blur}"/><feDiffuseLighting surfaceScale="${-R.depth}" diffuseConstant="1" lighting-color="white"><feDistantLight azimuth="${R.az}" elevation="${R.el}"/></feDiffuseLighting><feColorMatrix values="${matrix}"/></filter>`;
  const cut = `<use href="#${id}R" stroke="white" stroke-width="${R.w}"/>`;
  const rings = relief(s);
  const depth = (i: number) => Math.min(1, (rings.length - i) / (R.tail + 1));
  return `<svg class="cf-art" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>
${radial(`${id}k`, C.lift, LIFT)}${radial(`${id}d`, C.navy, DEEP)}${radial(`${id}l`, "white", WALLS, REACH)}${radial(`${id}p`, "white", SPARKLE)}${fade}
<mask id="${id}mx" ${box}>${rect(`url(#${id}x)`)}</mask>
<mask id="${id}ml" ${box}><g mask="url(#${id}mx)">${rect(`url(#${id}l)`)}</g></mask>
<mask id="${id}mp" ${box}><g mask="url(#${id}mx)">${rect(`url(#${id}p)`)}</g></mask>
<g id="${id}R" fill="none">${rings.map((d, i) => (d ? `<path d="${d}"${depth(i) < 1 ? ` opacity="${f(depth(i))}"` : ""}/>` : "")).join("")}</g>
${eng(`${id}hi`, `0 0 0 0 ${hr} 0 0 0 0 ${hg} 0 0 0 0 ${hb} 1.9 0 0 0 ${f(-1.9 * flat)}`)}
${eng(`${id}lo`, `0 0 0 0 ${lr} 0 0 0 0 ${lg} 0 0 0 0 ${lb} -1.4 0 0 0 ${f(1.4 * flat)}`)}
<filter id="${id}fl" ${area}><feColorMatrix in="SourceAlpha" values="0 0 0 0 ${fr} 0 0 0 0 ${fg} 0 0 0 0 ${fb} 0 0 0 0.15 0"/></filter>
<filter id="${id}z" ${area}><feTurbulence type="fractalNoise" baseFrequency="2.37" seed="${(no % 89) + 1}" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="6" xChannelSelector="R" yChannelSelector="G"/></filter>
${speck(`${id}gu`, no % 997, C.cream, 0.16, 0.5)}${speck(`${id}gd`, no % 997, C.navy, -0.6, 0.5)}${speck(`${id}gl`, (no % 997) + 500, C.cream, 30, 0.8)}
</defs>
<g filter="url(#${id}z)">${rect(C.navy)}${rect(`url(#${id}k)`)}${rect(`url(#${id}d)`, ' style="mix-blend-mode:multiply"')}</g>
<g mask="url(#${id}ml)"><g filter="url(#${id}lo)">${cut}</g><g filter="url(#${id}fl)">${cut}</g><g filter="url(#${id}hi)">${cut}</g></g>
<rect width="${W}" height="${H}" filter="url(#${id}gu)"/><rect width="${W}" height="${H}" filter="url(#${id}gd)" style="mix-blend-mode:multiply"/>
<g mask="url(#${id}mp)" opacity="0.4"><rect width="${W}" height="${H}" filter="url(#${id}gl)"/></g>
</svg>`;
}

const press = (id: string, [dx, dy, blur, shade]: number[], lip: number, C: Palette) =>
  `<filter id="${id}" x="-5%" y="-20%" width="110%" height="140%" color-interpolation-filters="sRGB">
<feComponentTransfer in="SourceAlpha" result="inv"><feFuncA type="table" tableValues="1 0 0"/></feComponentTransfer>
<feOffset in="inv" dx="${dx}" dy="${dy}"/><feGaussianBlur stdDeviation="${blur}" result="blur"/>
<feFlood flood-color="${C.navy}" flood-opacity="${shade}"/><feComposite in2="blur" operator="in"/><feComposite in2="SourceAlpha" operator="in" result="inner"/>
<feOffset in="SourceAlpha" dx="0.5" dy="0.7" result="lo"/><feComposite in="lo" in2="SourceAlpha" operator="out" result="lip"/>
<feFlood flood-color="${C.cream}" flood-opacity="${lip}"/><feComposite in2="lip" operator="in" result="lit"/>
<feMerge><feMergeNode in="lit"/><feMergeNode in="SourceGraphic"/><feMergeNode in="inner"/></feMerge></filter>`;

const esc = (v: string) => v.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

const nameHtml = (name: string) =>
  esc(name).replace(/\S+-\S+/g, (w) => `<span class="cf-k">${w}</span>`);

function card(no: number, C: Palette) {
  const filters = `<svg width="0" height="0" style="position:absolute" aria-hidden="true">${press("cf-press", [0.6, 0.8, 0.45, 0.55], 0.16, C)}${press("cf-press-sm", [0.35, 0.45, 0.3, 0.4], 0.12, C)}</svg>`;
  const face = `<div class="cf-f"><div class="cf-w">ColorStack at <span class="cf-gt" role="img" aria-label="Georgia Tech"></span></div><div class="cf-b"><div class="cf-n"></div><div class="cf-s"><span class="cf-l">Member since</span> <span class="cf-v"></span></div></div></div>`;
  return `${filters}<div class="cf-wrap"><div class="cf-tilt"><i class="cf-shade"></i><div class="cf">${art(no, C)}<i class="cf-sheen"></i>${face}<i class="cf-edge"></i></div></div></div>`;
}

function tilt(wrap: HTMLElement) {
  if (
    !matchMedia("(hover: hover) and (pointer: fine)").matches ||
    matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return () => {};
  }
  const K = 225;
  const D = 2 * Math.sqrt(K);
  const s = { tx: [0, 0, 0], ty: [0, 0, 0], h: [0, 0, 0] };
  const card = wrap.querySelector<HTMLElement>(".cf-tilt")!;
  const shade = wrap.querySelector<HTMLElement>(".cf-shade")!;
  const sheen = wrap.querySelector<HTMLElement>(".cf-sheen")!;
  card.style.willChange = "transform";
  shade.style.willChange = "opacity";
  sheen.style.willChange = "transform, opacity";
  let raf = 0;
  let last = 0;
  // Only transforms and opacity change, written straight onto their elements, so the ring art is never redrawn.
  const paint = () => {
    const [x, y, h] = [s.tx[0]!, s.ty[0]!, s.h[0]!];
    card.style.transform = `translateY(${-3 * h}px) rotateX(${-5 * y}deg) rotateY(${5 * x}deg)`;
    shade.style.opacity = sheen.style.opacity = String(h);
    sheen.style.transform = `translate(${25 * x}%, ${25 * y}%)`;
  };
  const step = (t: number) => {
    const dt = Math.min(0.032, last ? (t - last) / 1000 : 0.016);
    last = t;
    let moving = false;
    for (const v of Object.values(s)) {
      v[1] = v[1]! + (K * (v[2]! - v[0]!) - D * v[1]!) * dt;
      v[0] = v[0]! + v[1]! * dt;
      if (Math.abs(v[2]! - v[0]!) > 1e-3 || Math.abs(v[1]!) > 1e-3) moving = true;
      else v[0] = v[2]!;
    }
    paint();
    raf = moving ? requestAnimationFrame(step) : (last = 0);
  };
  const kick = () => {
    if (!raf) raf = requestAnimationFrame(step);
  };
  const clamp = (v: number) => Math.max(-1, Math.min(1, v));
  const move = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    const r = wrap.getBoundingClientRect();
    s.tx[2] = clamp(((e.clientX - r.left) / r.width) * 2 - 1);
    s.ty[2] = clamp(((e.clientY - r.top) / r.height) * 2 - 1);
    s.h[2] = 1;
    kick();
  };
  const leave = () => {
    s.tx[2] = s.ty[2] = s.h[2] = 0;
    kick();
  };
  wrap.addEventListener("pointermove", move);
  wrap.addEventListener("pointerleave", leave);
  return () => {
    cancelAnimationFrame(raf);
    wrap.removeEventListener("pointermove", move);
    wrap.removeEventListener("pointerleave", leave);
  };
}

function seedOf(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return ((h >>> 0) % 9999) + 1;
}

export function MemberCard({ me }: { me: Pick<Profile, "gtEmail" | "name" | "joinedAt"> }) {
  const host = useRef<HTMLDivElement>(null);
  const no = seedOf(me.gtEmail);
  const name = `${me.name?.firstName ?? ""} ${me.name?.lastName ?? ""}`.trim();
  const since = me.joinedAt
    ? new Date(me.joinedAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "";

  // The art depends only on the seed, so a name or date change rewrites the face's text and nothing else.
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const style = getComputedStyle(el);
    const token = (name: string) => style.getPropertyValue(name).trim();
    el.innerHTML = card(no, {
      navy: token("--cf-navy"),
      lift: token("--cf-lift"),
      cream: token("--cf-cream"),
      burdell: token("--cf-burdell"),
    });
    return tilt(el.querySelector<HTMLElement>(".cf-wrap")!);
  }, [no]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    el.querySelector(".cf-n")!.innerHTML = nameHtml(name);
    el.querySelector(".cf-v")!.textContent = since;
  }, [no, name, since]);

  return <div ref={host} className="cf-host" role="group" aria-label="Member card" />;
}
