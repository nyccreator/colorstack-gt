import { isGeorgiaTechEmail, normalizeEmail } from "@colorstack-gt/backend/convex/lib/identity";
import { MESSAGES } from "@colorstack-gt/backend/convex/lib/messages";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { type FormEvent, type RefObject, useEffect, useRef, useState } from "react";

import { sendCode } from "@/components/gate";
import { Mark } from "@/components/mark";
import { BusyLabel, Message } from "@/components/message";
import { startTokens } from "@/components/tokens";
import { useSlow } from "@/lib/motion";

export const Route = createFileRoute("/")({
  component: Landing,
});

const PARTNERS = [
  { name: "NVIDIA", src: "/assets/partners/nvidia.svg", height: 0.20455, shape: 585.8 / 108 },
  { name: "UKG", src: "/assets/partners/ukg.svg", height: 0.22, shape: 336 / 134 },
  { name: "ServiceNow", src: "/assets/partners/servicenow.svg", height: 0.18182, shape: 6.851 },
  { name: "Datadog", src: "/assets/partners/datadog.svg", height: 0.3, shape: 800.5 / 203.19 },
];

const COPIES = 8;

const TILTS = ["-6deg", "5deg", "-4deg"];

const sticker = (name: string) => `url(/assets/art/stickers/${name}.svg)`;
const BUZZ_EDGE = sticker("buzz-edge");

const FIGURES = [
  ["110+", "active members"],
  ["20+", "events per semester"],
  ["10+", "corporate partners"],
  ["80+", "offers last year"],
] as const;

const OFFERS = [
  {
    scene: "learn",
    chip: "Learn",
    statement: "Support for the classes you’re taking now and the skills you’ll need after.",
    band: "bg-blue-bright text-diploma",
    columns: "cols-3",
    items: [
      {
        title: "Study sessions",
        detail:
          "Set-aside time and a room to work through your own coursework with other members nearby.",
        ground: "bg-burdell text-navy",
        tone: "navy",
        icon: "study",
      },
      {
        title: "Workshops",
        detail: "Sessions on data structures, system design, and the tools you’ll use on the job.",
        ground: "bg-navy text-diploma",
        tone: "diploma",
        icon: "workshop",
      },
      {
        title: "Mentoring",
        detail: "Get paired with a student further along in the degree.",
        ground: "bg-diploma text-navy",
        tone: "navy",
        icon: "mentor",
      },
    ],
  },
  {
    scene: "hired",
    chip: "Get hired",
    statement:
      "Partner companies come to campus to meet our members, and we help you get ready for them.",
    band: "on-light bg-burdell text-navy",
    columns: "cols-3",
    items: [
      {
        title: "Company events",
        detail: "Companies come to us, so you can meet recruiters without the career fair crowd.",
        ground: "bg-navy text-diploma",
        tone: "diploma",
        icon: "company",
      },
      {
        title: "Panels",
        detail: "Students and alumni talk openly about how they got their offers.",
        ground: "bg-diploma text-navy",
        tone: "navy",
        icon: "panel",
      },
      {
        title: "Resume book",
        detail: "We collect member resumes and share them with our partner companies.",
        ground: "bg-blue-bright text-diploma",
        tone: "diploma",
        icon: "resume",
      },
    ],
  },
  {
    scene: "belong",
    chip: "Belong",
    statement: "Food, games, and connection with the rest of the chapter.",
    band: "bg-navy text-diploma",
    columns: "cols-2",
    items: [
      {
        title: "Mixers",
        detail: "Light networking with other members and the e-board.",
        ground: "bg-burdell text-navy",
        tone: "navy",
        icon: "mixer",
      },
      {
        title: "Hangouts",
        detail: "Time together around a shared hobby.",
        ground: "bg-diploma text-navy",
        tone: "navy",
        icon: "hangout",
      },
    ],
  },
] as const;

const PLAN = [
  { name: "hero", enter: 0, exit: 1 },
  { name: "mission", enter: 1, exit: 2 },
  { name: "learn", enter: 2, exit: 4, split: 3 },
  { name: "hired", enter: 4, exit: 6, split: 5 },
  { name: "belong", enter: 6, exit: 8, split: 7 },
  { name: "ask", enter: 8, split: 9, rest: 9 },
] as const;

const LIFT = 22;
const SETTLE_PX = 8;
const DRAG_PX = 10;
const SETTLES = Math.max(...PLAN.map((part) => ("split" in part ? part.split : part.enter))) + 1;

const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value);
const step = (progress: number, to: number) => clamp01(progress - (to - 1));
const toDevicePixels = (px: number) => Math.round(px * devicePixelRatio) / devicePixelRatio;
const holdNearStops = (raw: number, edge: number) => {
  const base = Math.floor(raw);
  return base + clamp01((raw - base - edge) / (1 - 2 * edge));
};

const tones = new Map<string, { luma: number; clear: boolean }>();
let swatch: CanvasRenderingContext2D | null | undefined;

function probe(color: string) {
  const known = tones.get(color);
  if (known) return known;
  if (swatch === undefined) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    swatch = canvas.getContext("2d", { willReadFrequently: true });
  }
  if (!swatch) return { luma: 1, clear: false };
  swatch.clearRect(0, 0, 1, 1);
  swatch.fillStyle = color;
  swatch.fillRect(0, 0, 1, 1);
  const alpha = swatch.getImageData(0, 0, 1, 1).data[3];
  swatch.globalCompositeOperation = "destination-over";
  swatch.fillStyle = "#ffffff";
  swatch.fillRect(0, 0, 1, 1);
  swatch.globalCompositeOperation = "source-over";
  const [r = 255, g = 255, b = 255] = swatch.getImageData(0, 0, 1, 1).data;
  const channel = (value: number) => {
    const ratio = value / 255;
    return ratio <= 0.03928 ? ratio / 12.92 : Math.pow((ratio + 0.055) / 1.055, 2.4);
  };
  const tone = {
    luma: 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b),
    clear: alpha === 0,
  };
  tones.set(color, tone);
  return tone;
}

function useStage(root: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const landing = root.current;
    const stage = landing?.querySelector<HTMLElement>(".stage");
    const band = landing?.querySelector<HTMLElement>(".nav-band");
    if (!landing || !stage || !band) return;

    const tokens = startTokens(landing);
    const scenes = PLAN.map((part) => ({
      ...part,
      el: stage.querySelector<HTMLElement>(`[data-scene="${part.name}"]`),
    }));
    const shell = stage.parentElement as HTMLElement;
    const stride = () =>
      shell.getBoundingClientRect().height /
      (parseFloat(getComputedStyle(shell).getPropertyValue("--stages")) || 1);
    const parts = [...landing.querySelectorAll<HTMLElement>("[data-tone]")];
    const still = matchMedia("(prefers-reduced-motion: reduce)");
    const coarse = matchMedia("(pointer: coarse)");

    const groundAt = (x: number, y: number) => {
      for (const element of document.elementsFromPoint(x, y)) {
        if (band.contains(element)) continue;
        const ground = probe(getComputedStyle(element).backgroundColor);
        if (!ground.clear) return ground.luma;
      }
      return probe("rgb(249, 246, 229)").luma;
    };

    const tone = () => {
      const box = band.getBoundingClientRect();
      if (box.bottom <= 0) return;
      for (const part of parts) {
        if (!part.offsetParent) continue;
        const rect = part.getBoundingClientRect();
        const x = Math.min(innerWidth - 2, Math.max(2, (rect.left + rect.right) / 2));
        part.classList.toggle("on-dark", groundAt(x, box.bottom + 2) < 0.25);
      }
    };

    const handed = new Map<string, number>();
    let heldStop: number | null = null;
    const draw = () => {
      if (still.matches) {
        for (const scene of scenes) {
          scene.el?.style.removeProperty("--y");
          scene.el?.style.removeProperty("--t");
        }
        tokens.settle();
        tone();
        return;
      }
      const unit = stride();
      const raw = heldStop ?? window.scrollY / unit;
      const progress = holdNearStops(raw, SETTLE_PX / unit);
      const moved: { el: HTMLElement; name: string; t: number }[] = [];
      const height = stage.clientHeight;
      for (const scene of scenes) {
        if (!scene.el) continue;
        const into = scene.enter === 0 ? 1 : step(progress, scene.enter);
        const out = "exit" in scene ? step(progress, scene.exit) : 0;
        const covered = out === 1;
        const y = covered ? -height : (((1 - into) * 100 - out * LIFT) / 100) * height;
        scene.el.style.setProperty("--y", `${toDevicePixels(y)}px`);
        if ("split" in scene) {
          const t = step(progress, scene.split);
          scene.el.style.setProperty("--t", t.toFixed(4));
          if (handed.get(scene.name) !== t) moved.push({ el: scene.el, name: scene.name, t });
        }
      }
      for (const { el, name, t } of moved) {
        handed.set(name, t);
        tokens.hand(el, t);
      }
      tone();
    };

    let frame = 0;
    const onScroll = () => {
      if (frame || still.matches) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        draw();
      });
    };
    const onResize = () => {
      handed.clear();
      onScroll();
    };
    const onMotion = () => {
      handed.clear();
      draw();
    };

    let pointerFocus = false;
    const onPointer = () => (pointerFocus = true);
    const onKey = () => (pointerFocus = false);
    const followKeyboardFocus = (event: FocusEvent) => {
      if (still.matches || pointerFocus) return;
      const scene = scenes.find((part) => part.el?.contains(event.target as Node));
      if (!scene) return;
      const y = ("rest" in scene ? scene.rest : scene.enter) * stride();
      if (Math.abs(window.scrollY - y) > 1) window.scrollTo({ top: y, behavior: "instant" });
    };

    const holdStage = () => {
      const unit = stride();
      heldStop = Math.round(window.scrollY / unit);
      const top = heldStop * unit;
      stage.style.top = `${top}px`;
      shell.style.height = `${top + stage.offsetHeight}px`;
      landing.classList.add("typing");
    };
    const releaseStage = (top: number) => {
      heldStop = null;
      stage.style.removeProperty("top");
      shell.style.removeProperty("height");
      landing.classList.remove("typing");
      window.scrollTo({ top, behavior: "instant" });
    };
    const afterTap = (fn: () => void) => window.setTimeout(fn);

    let release = 0;
    const onFocusIn = (event: FocusEvent) => {
      if (still.matches || !coarse.matches || !(event.target as Element).matches("input")) {
        followKeyboardFocus(event);
        return;
      }
      clearTimeout(release);
      if (heldStop !== null) return;
      holdStage();
    };
    const onFocusOut = () => {
      if (heldStop === null) return;
      const top = parseFloat(stage.style.top);
      release = afterTap(() => releaseStage(top));
    };

    let dragFrom: number | null = null;
    const armDismissKeyboardOnDrag = (event: TouchEvent) => {
      const from = event.target as Element;
      dragFrom = heldStop !== null && !from.closest("input") ? event.touches[0]!.clientY : null;
    };
    const dismissKeyboardOnDrag = (event: TouchEvent) => {
      if (dragFrom === null || Math.abs(event.touches[0]!.clientY - dragFrom) < DRAG_PX) return;
      dragFrom = null;
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    };

    draw();
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onResize);
    addEventListener("pointerdown", onPointer, true);
    addEventListener("keydown", onKey, true);
    stage.addEventListener("focusin", onFocusIn);
    stage.addEventListener("focusout", onFocusOut);
    addEventListener("touchstart", armDismissKeyboardOnDrag, { passive: true });
    addEventListener("touchmove", dismissKeyboardOnDrag, { passive: true });
    still.addEventListener("change", onMotion);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(release);
      tokens.stop();
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", onResize);
      removeEventListener("pointerdown", onPointer, true);
      removeEventListener("keydown", onKey, true);
      stage.removeEventListener("focusin", onFocusIn);
      stage.removeEventListener("focusout", onFocusOut);
      removeEventListener("touchstart", armDismissKeyboardOnDrag);
      removeEventListener("touchmove", dismissKeyboardOnDrag);
      still.removeEventListener("change", onMotion);
    };
  }, [root]);
}

function Shadow({ art }: { art: string }) {
  return (
    <span className="sh">
      <span style={{ maskImage: art }} />
    </span>
  );
}

function Token({
  art,
  buzz = false,
  cycle = false,
  children,
}: {
  art: readonly string[];
  buzz?: boolean;
  cycle?: boolean;
  children: string;
}) {
  return (
    <span
      className={cycle ? "tk cyc" : "tk"}
      data-cycle={cycle ? "" : undefined}
      role={cycle ? "button" : undefined}
      tabIndex={cycle ? 0 : undefined}
      aria-label={cycle ? `${children}, show another example` : undefined}
    >
      <span className="tk-art" aria-hidden>
        {art.map((src, index) => (
          <span
            key={src}
            className={`tk-pic${buzz ? " buzz" : ""}${index === 0 ? " on" : ""}`}
            style={{ "--art": src, "--r": TILTS[index] }}
          >
            <Shadow art={buzz ? BUZZ_EDGE : src} />
          </span>
        ))}
      </span>
      {children}
    </span>
  );
}

function JoinField({ id }: { id: string }) {
  const { token } = Route.useRouteContext();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState(false);
  const slow = useSlow(pending);

  function fail(message: string) {
    setError(message);
    setShown(true);
    setAttempt((count) => count + 1);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim() || !isGeorgiaTechEmail(email)) {
      fail(email.trim() ? MESSAGES.wrongDomain : MESSAGES.noEmail);
      return;
    }

    setPending(true);
    const address = normalizeEmail(email);
    const failure = await sendCode(address);
    setPending(false);

    if (failure) {
      fail(failure);
      return;
    }
    void navigate({ to: "/join", search: { email: address, sent: true } });
  }

  if (token) {
    return (
      <Link to="/hub" className="lp-btn">
        Go to events
      </Link>
    );
  }

  return (
    <div className="lp-field">
      <form className="lp-join" onSubmit={submit} noValidate>
        <label htmlFor={id} className="sr-only">
          Georgia Tech email
        </label>
        <input
          id={id}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@gatech.edu"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setShown(false);
          }}
          aria-invalid={shown ? true : undefined}
          aria-describedby={shown ? `${id}-error` : undefined}
        />
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending || undefined}
          className="lp-btn lp-send"
        >
          <BusyLabel slow={slow} idle="Join" busy="Sending…" />
        </button>
      </form>
      <div className="lp-reveal" aria-hidden={!shown}>
        <div>
          {error ? (
            <Message key={attempt} tone="error" id={`${id}-error`} centered>
              {error}
            </Message>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Offer({ offer, z }: { offer: (typeof OFFERS)[number]; z: string }) {
  return (
    <section className={`scene split ${z}`} data-scene={offer.scene}>
      <div className={`band ${offer.band}`}>
        <div className="stmt">
          <h2 className="stmt-h type-display text-balance">{offer.statement}</h2>
          <p className="tag type-display">
            <Token art={offer.items.map((item) => sticker(item.icon))} cycle>
              {offer.chip}
            </Token>
          </p>
        </div>
      </div>
      <div className={`tiles ${offer.columns}`}>
        {offer.items.map((item, index) => (
          <div key={item.title} className={`tile ${item.ground}`}>
            <span
              className="it-st"
              aria-hidden
              style={{ "--art": sticker(item.icon), "--r": TILTS[index] }}
            >
              <Shadow art={sticker(item.icon)} />
            </span>
            <div className="it-tx">
              <b className="it-t type-display text-item-title">{item.title}</b>
              <p
                className={`it-d text-band-body ${
                  item.tone === "navy" ? "text-navy/70" : "text-diploma/86"
                }`}
              >
                {item.detail}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Landing() {
  const { token } = Route.useRouteContext();
  const root = useRef<HTMLDivElement>(null);

  useStage(root);

  return (
    <div className="landing" ref={root}>
      <header className="nav-band">
        <div className="rail">
          <nav className="nav" aria-label="Main">
            <Link
              to="/"
              aria-label="ColorStack at Georgia Tech, home"
              className="nav-home on-dark"
              data-tone
            >
              <Mark mark="lockup-light" className="nav-lock" />
              <Mark mark="lockup" className="nav-lock nav-lock-over" />
            </Link>
            <div className="nav-acts on-dark" data-tone>
              {token ? (
                <Link to="/hub" className="lp-link type-nav">
                  Events
                </Link>
              ) : (
                <>
                  <Link to="/sign-in" className="lp-link type-nav">
                    Sign in
                  </Link>
                  <Link to="/join" className="lp-link type-nav">
                    Join
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      </header>

      <div className="shell" id="top">
        <div className="stage">
          <section className="scene sc-1 s-hero" data-scene="hero">
            <div className="hero-in on-dark bg-blue-bright text-diploma">
              <div className="hero-copy">
                <p className="type-eyebrow text-diploma/86">
                  ColorStack at <span className="gtw" role="img" aria-label="Georgia Tech" />
                </p>
                <h1 className="hero-h type-display text-balance">
                  A community for Black, Latinx and allied{" "}
                  <Token art={["buzz"]} buzz>
                    students
                  </Token>{" "}
                  in <span className="keep">computing.</span>
                </h1>
                <div className="hero-rest">
                  <p className="hero-lede text-lede text-diploma/86">
                    Study sessions, workshops, company events, and socials, run by students at
                    Georgia&nbsp;Tech.
                  </p>
                  <JoinField id="hero-email" />
                </div>
              </div>
            </div>
            <div className="marks bg-diploma" role="region" aria-label="Partner companies">
              <div className="track">
                {Array.from({ length: COPIES }, (_, copy) =>
                  PARTNERS.map((partner) => (
                    <span
                      key={`${copy}-${partner.name}`}
                      className="mk"
                      role={copy === 0 ? "img" : undefined}
                      aria-label={copy === 0 ? partner.name : undefined}
                      aria-hidden={copy > 0 || undefined}
                      style={{
                        "--hr": partner.height,
                        "--src": `url(${partner.src})`,
                        aspectRatio: partner.shape,
                      }}
                    />
                  )),
                )}
              </div>
            </div>
          </section>

          <section className="scene sc-2 mos s-mission" data-scene="mission">
            <div className="bx mis-copy bg-burdell text-navy">
              <p className="type-eyebrow">Our mission</p>
              <h2 className="mis-h mt-3 type-display text-band text-balance">
                More of us graduate, and more of us start careers in tech.
              </h2>
              <p className="mis-lede text-lede">
                ColorStack works to increase the number of Black and Latinx students who finish
                computing degrees and go on to rewarding technical careers. Our chapter does that
                work at Georgia&nbsp;Tech through academic support, career preparation, and
                community.
              </p>
            </div>
            <div className="bx bg-navy text-diploma">
              <dl className="figs">
                {FIGURES.map(([figure, label]) => (
                  <div key={label} className="flex flex-col-reverse">
                    <dt className="fig-l mt-2 text-band-body text-diploma/86">{label}</dt>
                    <dd className="fig-n m-0 type-display">{figure}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>

          {OFFERS.map((offer, index) => (
            <Offer key={offer.scene} offer={offer} z={`sc-${index + 3}`} />
          ))}

          <section className="scene sc-6 split" data-scene="ask">
            <div className="s-ask on-dark bg-blue-bright text-diploma">
              <div className="ask-copy">
                <h2 className="ask-h type-display">
                  Start with{" "}
                  <span className="keep">
                    <Token art={[sticker("event")]}>one event.</Token>
                  </span>
                </h2>
                <div className="ask-rest">
                  <p className="ask-lede text-lede text-diploma/86">
                    Events are open to every Georgia&nbsp;Tech student and membership is&nbsp;free.
                    Come to one and see if it’s for you.
                  </p>
                  <JoinField id="ask-email" />
                </div>
              </div>
            </div>
            <footer className="items bg-navy text-diploma">
              <div className="bx">
                <div className="foot-in">
                  <Mark mark="lockup" label="ColorStack at Georgia Tech" className="foot-lock" />
                  <div>
                    <p className="mb-1.5 font-display text-base font-medium text-diploma/86">
                      Reach us
                    </p>
                    <div className="foot-links">
                      <a href="mailto:colorstackgt@gmail.com">colorstackgt@gmail.com</a>
                      <a
                        href="https://www.instagram.com/colorstackgt/"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Instagram
                      </a>
                      <a
                        href="https://gatech.campuslabs.com/engage/organization/colorstack-at-gt"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Engage
                      </a>
                      <a
                        href="https://www.linkedin.com/company/colorstack-georgia-tech/"
                        target="_blank"
                        rel="noreferrer"
                      >
                        LinkedIn
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </footer>
          </section>
        </div>
        {Array.from({ length: SETTLES }, (_, index) => (
          <span key={index} aria-hidden className="snap" style={{ "--k": index }} />
        ))}
      </div>
    </div>
  );
}
