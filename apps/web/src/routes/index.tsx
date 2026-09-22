import { isGeorgiaTechEmail, normalizeEmail } from "@colorstack-gt/backend/convex/lib/identity";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useEffect, useState } from "react";

import { sendCode, WRONG_DOMAIN } from "@/components/gate";
import { Mark } from "@/components/mark";
import { Message } from "@/components/message";

export const Route = createFileRoute("/")({
  component: Landing,
});

const PARTNERS = [
  { name: "NVIDIA", src: "/assets/partners/nvidia.svg", height: 0.20455 },
  { name: "UKG", src: "/assets/partners/ukg.svg", height: 0.29545 },
  { name: "ServiceNow", src: "/assets/partners/servicenow.svg", height: 0.18182 },
  { name: "Datadog", src: "/assets/partners/datadog.svg", height: 0.23864 },
];

const COPIES = 5;

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
    statement: "Support for the classes you're taking now and the skills you'll need after.",
    band: "bg-blue-bright text-diploma",
    columns: "cols-3",
    items: [
      {
        title: "Study sessions",
        detail:
          "Set-aside time and a room to work through your own coursework with other members nearby.",
        ground: "bg-burdell text-navy",
      },
      {
        title: "Workshops",
        detail: "Sessions on data structures, system design, and the tools you'll use on the job.",
        ground: "bg-navy text-diploma",
      },
      {
        title: "Mentoring",
        detail: "Get paired with a student further along in the degree.",
        ground: "bg-diploma text-navy",
      },
    ],
  },
  {
    scene: "hired",
    chip: "Get hired",
    statement:
      "Partner companies come to campus to meet our members, and we help you get ready for them.",
    band: "bg-burdell text-navy",
    columns: "cols-3",
    items: [
      {
        title: "Company events",
        detail: "Companies come to us, so you can meet recruiters without the career fair crowd.",
        ground: "bg-navy text-diploma",
      },
      {
        title: "Panels",
        detail: "Students and alumni talk openly about how they got their offers.",
        ground: "bg-diploma text-navy",
      },
      {
        title: "Resume book",
        detail: "We collect member resumes and share them with our partner companies.",
        ground: "bg-blue-bright text-diploma",
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
      },
      {
        title: "Hangouts",
        detail: "Time together around a shared hobby.",
        ground: "bg-diploma text-navy",
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
  { name: "ask", enter: 8, split: 9 },
] as const;

const PAD = 0.14;
const LIFT = 22;
const CATCH = 0.25;
const GLIDE_MIN = 220;
const GLIDE_MAX = 460;
const SETTLES = Math.max(...PLAN.map((part) => ("split" in part ? part.split : part.enter))) + 1;

const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value);
const ease = (t: number) => t * t * (3 - 2 * t);
const step = (progress: number, to: number) =>
  ease(clamp01((progress - (to - 1) - PAD) / (1 - 2 * PAD)));

const tones = new Map<string, number>();
let swatch: CanvasRenderingContext2D | null | undefined;

function luminance(color: string): number {
  const known = tones.get(color);
  if (known !== undefined) return known;
  if (swatch === undefined) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    swatch = canvas.getContext("2d", { willReadFrequently: true });
  }
  if (!swatch) return 1;
  swatch.fillStyle = "#ffffff";
  swatch.fillRect(0, 0, 1, 1);
  swatch.fillStyle = color;
  swatch.fillRect(0, 0, 1, 1);
  const [r = 255, g = 255, b = 255] = swatch.getImageData(0, 0, 1, 1).data;
  const channel = (value: number) => {
    const ratio = value / 255;
    return ratio <= 0.03928 ? ratio / 12.92 : Math.pow((ratio + 0.055) / 1.055, 2.4);
  };
  const value = 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  tones.set(color, value);
  return value;
}

function useStage() {
  useEffect(() => {
    const stage = document.querySelector<HTMLElement>(".stage");
    const band = document.querySelector<HTMLElement>(".nav-band");
    if (!stage || !band) return;

    const scenes = PLAN.map((part) => ({
      ...part,
      el: stage.querySelector<HTMLElement>(`[data-scene="${part.name}"]`),
    }));
    const shell = stage.parentElement as HTMLElement;
    const stride = () =>
      shell.getBoundingClientRect().height /
      (parseFloat(getComputedStyle(shell).getPropertyValue("--stages")) || 1);
    const parts = [...document.querySelectorAll<HTMLElement>("[data-tone]")];
    const still = matchMedia("(prefers-reduced-motion: reduce)");

    const groundAt = (x: number, y: number) => {
      for (const element of document.elementsFromPoint(x, y)) {
        if (band.contains(element)) continue;
        const color = getComputedStyle(element).backgroundColor;
        if (color && color !== "transparent" && !/,\s*0\)$/.test(color)) return color;
      }
      return "rgb(249, 246, 229)";
    };

    const tone = () => {
      const box = band.getBoundingClientRect();
      for (const part of parts) {
        if (!part.offsetParent) continue;
        const rect = part.getBoundingClientRect();
        const x = Math.min(innerWidth - 2, Math.max(2, (rect.left + rect.right) / 2));
        part.classList.toggle("on-dark", luminance(groundAt(x, box.bottom + 2)) < 0.25);
      }
    };

    const draw = () => {
      if (!still.matches) {
        const progress = window.scrollY / stride();
        for (const scene of scenes) {
          if (!scene.el) continue;
          const into = scene.enter === 0 ? 1 : step(progress, scene.enter);
          const out = "exit" in scene ? step(progress, scene.exit) : 0;
          scene.el.style.setProperty("--y", `${(1 - into) * 100 - out * LIFT}%`);
          if ("split" in scene) {
            scene.el.style.setProperty("--t", step(progress, scene.split).toFixed(4));
          }
        }
      } else {
        for (const scene of scenes) {
          scene.el?.style.removeProperty("--y");
          scene.el?.style.removeProperty("--t");
        }
      }
      tone();
    };

    let held = false;
    let idle: ReturnType<typeof setTimeout>;
    let glide = 0;

    const ride = (to: number) => {
      const from = window.scrollY;
      const span = to - from;
      if (Math.abs(span) < 2) return;
      const time = Math.min(GLIDE_MAX, GLIDE_MIN + Math.abs(span) * 0.35);
      const began = performance.now();
      const frame = (now: number) => {
        const t = clamp01((now - began) / time);
        window.scrollTo(0, from + span * (1 - Math.pow(1 - t, 3)));
        glide = t < 1 ? requestAnimationFrame(frame) : 0;
      };
      glide = requestAnimationFrame(frame);
    };

    const settle = () => {
      if (held || glide || still.matches) return;
      const height = stride();
      const progress = window.scrollY / height;
      const nearest = Math.min(Math.max(Math.round(progress), 0), SETTLES - 1);
      const off = Math.abs(progress - nearest);
      if (off < 0.01 || off > CATCH) return;
      ride(nearest * height);
    };

    const stop = () => {
      if (glide) cancelAnimationFrame(glide);
      glide = 0;
      clearTimeout(idle);
    };

    let queued = false;
    const onScroll = () => {
      if (!glide) {
        clearTimeout(idle);
        idle = setTimeout(settle, 90);
      }
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        draw();
      });
    };

    const onInput = () => {
      stop();
      idle = setTimeout(settle, 90);
    };

    const onDown = () => {
      held = true;
      stop();
    };
    const onUp = () => {
      held = false;
      idle = setTimeout(settle, 90);
    };

    draw();
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll);
    addEventListener("wheel", onInput, { passive: true });
    addEventListener("touchstart", onInput, { passive: true });
    addEventListener("keydown", onInput);
    addEventListener("pointerdown", onDown, { passive: true });
    addEventListener("pointerup", onUp, { passive: true });
    still.addEventListener("change", draw);
    return () => {
      stop();
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", onScroll);
      removeEventListener("wheel", onInput);
      removeEventListener("touchstart", onInput);
      removeEventListener("keydown", onInput);
      removeEventListener("pointerdown", onDown);
      removeEventListener("pointerup", onUp);
      still.removeEventListener("change", draw);
    };
  }, []);
}

function JoinField({ id }: { id: string }) {
  const { isAuthenticated } = Route.useRouteContext();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isGeorgiaTechEmail(email)) {
      setError(WRONG_DOMAIN);
      return;
    }

    setPending(true);
    const address = normalizeEmail(email);
    const failure = await sendCode(address);
    setPending(false);

    if (failure) {
      setError(failure);
      return;
    }
    void navigate({ to: "/join", search: { email: address, sent: true } });
  }

  if (isAuthenticated) {
    return (
      <div className="lp-join">
        <Link to="/hub" className="lp-btn">
          Go to my hub
        </Link>
      </div>
    );
  }

  return (
    <>
      <form className="lp-join" onSubmit={submit} noValidate>
        <label htmlFor={id} className="sr-only">
          Email address
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
            setError(null);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <button type="submit" disabled={pending} className="lp-btn">
          {pending ? "Sending" : "Join"}
        </button>
      </form>
      {error ? (
        <Message tone="error" id={`${id}-error`}>
          {error}
        </Message>
      ) : null}
    </>
  );
}

function Offer({ offer, z }: { offer: (typeof OFFERS)[number]; z: string }) {
  return (
    <section className={`scene split ${z}`} data-scene={offer.scene}>
      <div className={`band ${offer.band}`}>
        <div className="rail stmt">
          <h2 className="type-display text-band text-balance">{offer.statement}</h2>
          <span className="lp-chip">{offer.chip}</span>
        </div>
      </div>
      <div className={`items mos ${offer.columns}`}>
        {offer.items.map((item) => (
          <div key={item.title} className={`bx item ${item.ground}`}>
            <b className="type-heading text-item-title">{item.title}</b>
            <p
              className={`max-w-[34ch] text-band-body ${
                item.ground.includes("text-navy") ? "text-navy/70" : "text-diploma/86"
              }`}
            >
              {item.detail}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Landing() {
  const { isAuthenticated } = Route.useRouteContext();
  const [learn, hired, belong] = OFFERS;

  useStage();

  return (
    <div className="landing">
      <header className="nav-band">
        <div className="rail">
          <nav className="nav" aria-label="Main">
            <Link
              to="/"
              aria-label="ColorStack at Georgia Tech, home"
              className="on-dark"
              data-tone
            >
              <Mark mark="lockup" className="nav-lock" />
            </Link>
            <div className="nav-acts on-dark" data-tone>
              {isAuthenticated ? (
                <Link to="/hub" className="lp-btn">
                  Member hub
                </Link>
              ) : (
                <>
                  <Link to="/sign-in" className="lp-btn lp-ghost">
                    Sign in
                  </Link>
                  <Link to="/join" className="lp-btn">
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
            <div className="mos hero-in on-dark bg-blue-bright text-diploma">
              <div className="bx">
                <p className="type-eyebrow text-diploma/86">ColorStack at Georgia Tech</p>
                <h1 className="mt-3 type-display text-hero text-balance">
                  A community for Black, Latinx and allied students in computing.
                </h1>
                <p className="hero-lede text-lede text-diploma/86">
                  Study sessions, workshops, company events, and socials, run by students at Georgia
                  Tech.
                </p>
                <JoinField id="hero-email" />
              </div>
              <div className="bx art-box">
                <Mark
                  mark="buzz"
                  label="Buzz, the Georgia Tech Yellow Jacket"
                  className="hero-buzz"
                />
              </div>
            </div>
            <div className="marks bg-diploma" role="region" aria-label="Partner companies">
              <div className="track">
                {Array.from({ length: COPIES }, (_, copy) =>
                  PARTNERS.map((partner) => (
                    <img
                      key={`${copy}-${partner.name}`}
                      src={partner.src}
                      alt={copy === 0 ? partner.name : ""}
                      aria-hidden={copy > 0}
                      style={{ "--hr": partner.height } as React.CSSProperties}
                    />
                  )),
                )}
              </div>
            </div>
          </section>

          <section className="scene sc-2 mos s-mission" data-scene="mission">
            <div className="bx mis-copy bg-burdell text-navy">
              <p className="type-eyebrow">Our mission</p>
              <h2 className="mt-3 type-display text-band text-balance">
                More of us graduate, and more of us start careers in tech.
              </h2>
              <p className="mt-4 text-lede">
                ColorStack works to increase the number of Black and Latinx students who finish
                computing degrees and go on to rewarding technical careers. Our chapter does that
                work at Georgia Tech through academic support, career preparation, and community.
              </p>
            </div>
            <div className="bx bg-navy text-diploma">
              <dl className="figs">
                {FIGURES.map(([figure, label]) => (
                  <div key={label}>
                    <dt className="sr-only">{label}</dt>
                    <dd className="m-0">
                      <span className="fig-n block type-display text-stat">{figure}</span>
                      <span className="mt-2 block text-band-body text-diploma/86">{label}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>

          {learn ? <Offer offer={learn} z="sc-3" /> : null}
          {hired ? <Offer offer={hired} z="sc-4" /> : null}
          {belong ? <Offer offer={belong} z="sc-5" /> : null}

          <section className="scene sc-6 split" data-scene="ask">
            <div className="mos s-ask on-dark bg-blue-bright text-diploma">
              <div className="bx ask-copy">
                <p className="type-eyebrow text-diploma/86">Come by</p>
                <h2 className="mt-3 type-display text-band">Start with one event.</h2>
                <p className="ask-lede text-lede text-diploma/86">
                  Events are open to every Georgia Tech student and membership is free. Come to one
                  and see if it's for you.
                </p>
                <JoinField id="ask-email" />
              </div>
              <div className="bx art-box">
                <Mark mark="wreck" className="wreck" />
              </div>
            </div>
            <footer className="items bg-navy text-diploma">
              <div className="bx">
                <div className="foot-in">
                  <Mark mark="lockup" label="ColorStack at Georgia Tech" className="foot-lock" />
                  <div>
                    <p className="mb-1.5 type-micro text-diploma/64">Reach us</p>
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
      </div>
    </div>
  );
}
