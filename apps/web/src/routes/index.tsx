import { isGeorgiaTechEmail, normalizeEmail } from "@colorstack-gt/backend/convex/lib/identity";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { type CSSProperties, type FormEvent, useState } from "react";

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

const COPIES = 8;

function setSpeed(carousel: HTMLElement, rate: number) {
  for (const animation of carousel.getAnimations({ subtree: true })) {
    animation.updatePlaybackRate(rate);
  }
}

const STATS = [
  ["140+", "members"],
  ["6", "company partners"],
  ["30+", "offers last year"],
  ["20+", "events last year"],
] as const;

const OFFERS = [
  {
    title: "Learn.",
    lede: "Support for the classes you're taking now and the skills you'll need after.",
    items: [
      [
        "Study sessions",
        "Set-aside time and a room to work through your own coursework with other members nearby.",
      ],
      [
        "Workshops",
        "Sessions on data structures, system design, and the tools you'll use on the job.",
      ],
      ["Mentoring", "Get paired with a student further along in the degree."],
    ],
    art: "/assets/art/learn-rise.svg",
    crop: "100% 0%",
    light: true,
  },
  {
    title: "Get hired.",
    lede: "Partner companies come to campus to meet our members, and we help you get ready for them.",
    items: [
      [
        "Company events",
        "Companies come to us, so you can meet recruiters without the career fair crowd.",
      ],
      ["Panels", "Students and alumni talk openly about how they got their offers."],
      ["Resume book", "We collect member resumes and share them with our partner companies."],
    ],
    art: "/assets/art/hired-rise.svg",
    crop: "0% 50%",
    light: false,
  },
  {
    title: "Belong.",
    lede: "Food, games, and connection with the rest of the chapter.",
    items: [
      ["Mixers", "Light networking with other members and the e-board."],
      ["Hangouts", "Time together around a shared hobby."],
    ],
    art: "/assets/art/belong-rise.svg",
    crop: "100% 100%",
    light: true,
  },
] as const;

function JoinField({ id }: { id: string }) {
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

  return (
    <>
      <form className="lp-field" onSubmit={submit} noValidate>
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
        <button type="submit" disabled={pending} className="type-button">
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

function Offer({ offer, reversed }: { offer: (typeof OFFERS)[number]; reversed: boolean }) {
  const muted = offer.light ? "text-navy/62" : "text-diploma/74";
  return (
    <section className={`lp-band lp-offer ${offer.light ? "lp-light" : ""}`}>
      <div className={`lp-in ${reversed ? "lp-rev" : ""}`}>
        <div className="lp-tx">
          <h3 className="type-heading text-band">{offer.title}</h3>
          <p className={`mt-2.5 max-w-[40ch] text-band-body ${muted}`}>{offer.lede}</p>
          <ul className="lp-items">
            {offer.items.map(([name, detail]) => (
              <li key={name}>
                <b className="text-item-title font-bold">{name}</b>
                <span className={`block text-item ${muted}`}>{detail}</span>
              </li>
            ))}
          </ul>
        </div>
        <div
          aria-hidden
          className="lp-th"
          style={{ backgroundImage: `url(${offer.art})`, "--bgp": offer.crop } as CSSProperties}
        />
      </div>
    </section>
  );
}

function Landing() {
  const { isAuthenticated } = Route.useRouteContext();
  const [learn, hired, belong] = OFFERS;

  return (
    <div className="landing">
      <header className="lp-nav">
        <Link to="/" aria-label="ColorStack at Georgia Tech, home" className="h-11.5">
          <Mark mark="lockup" className="h-full" />
        </Link>
        <div className="lp-acts">
          {isAuthenticated ? (
            <Link to="/hub" className="lp-cta">
              Member hub
            </Link>
          ) : (
            <>
              <Link to="/sign-in" className="lp-ghost">
                Sign in
              </Link>
              <Link to="/join" className="lp-cta">
                Join
              </Link>
            </>
          )}
        </div>
      </header>

      <div className="lp-flow">
        <div className="grain" />

        <div className="lp-screen lp-first">
          <div className="lp-hero">
            <span className="lp-buzz">
              <Mark mark="buzz" className="h-full" />
            </span>
            <div className="lp-copy">
              <p className="mb-2.5 type-eyebrow text-diploma/62">ColorStack at Georgia Tech</p>
              <h1 className="type-display text-hero text-balance">
                A community for Black and Latinx students in computing.
              </h1>
              <p className="mt-3 max-w-[38ch] text-lede text-diploma/62">
                Study sessions, workshops, company events, and socials, run by students at Georgia
                Tech.
              </p>
              <JoinField id="hero-email" />
            </div>
          </div>

          <div
            className="lp-car"
            id="partners"
            role="region"
            aria-label="Partner companies"
            onPointerEnter={(event) => setSpeed(event.currentTarget, 0.25)}
            onPointerLeave={(event) => setSpeed(event.currentTarget, 1)}
          >
            <div className="lp-track">
              {Array.from({ length: COPIES }, (_, copy) =>
                PARTNERS.map((partner) => (
                  <img
                    key={`${copy}-${partner.name}`}
                    src={partner.src}
                    alt={copy === 0 ? partner.name : ""}
                    aria-hidden={copy > 0 || undefined}
                    style={{ "--hr": partner.height } as CSSProperties}
                  />
                )),
              )}
            </div>
          </div>
        </div>

        <div className="lp-screen">
          <section className="lp-band" id="about">
            <div className="lp-numband">
              <div>
                <p className="mb-2.5 type-eyebrow text-diploma/62">Our mission</p>
                <h2 className="type-heading text-section">
                  More of us graduate, and more of us start careers in tech.
                </h2>
                <p className="mt-2.5 max-w-[46ch] text-lede text-diploma/62">
                  ColorStack works to increase the number of Black and Latinx students who finish
                  computing degrees and go on to rewarding technical careers. Our chapter does that
                  work at Georgia Tech through academic support, career preparation, and community.
                </p>
              </div>
              <div className="lp-nums">
                {STATS.map(([value, label]) => (
                  <div key={label}>
                    <div className="lp-stat text-stat">{value}</div>
                    <div className="mt-2.25 max-w-[18ch] text-item text-diploma/62">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
          <div id="offer" className="contents">
            <Offer offer={learn} reversed={false} />
          </div>
        </div>

        <div className="lp-screen">
          <Offer offer={hired} reversed />
          <Offer offer={belong} reversed={false} />
        </div>

        <div className="lp-screen lp-last">
          <section className="lp-band lp-ask">
            <img src="/assets/art/wreck.svg" alt="" className="lp-wreck" />
            <p className="mb-2.5 type-eyebrow text-diploma/62">Come by</p>
            <h2 className="type-heading text-section">Start with one event.</h2>
            <p className="mt-2.5 max-w-[46ch] text-lede text-diploma/62">
              Events are open to every Georgia Tech student and membership is free. Come to one and
              see if it's for you.
            </p>
            <JoinField id="ask-email" />
          </section>

          <footer>
            <div className="lp-foot" id="board">
              <div className="lp-cols">
                <Mark
                  mark="lockup"
                  label="ColorStack at Georgia Tech"
                  className="w-[clamp(74px,8vw,124px)]"
                />
                <div className="lp-linkgroup">
                  <div>
                    <p className="lp-colh">REACH US</p>
                    <a href="mailto:board@colorstackgt.org">board@colorstackgt.org</a>
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
        </div>
      </div>
    </div>
  );
}
