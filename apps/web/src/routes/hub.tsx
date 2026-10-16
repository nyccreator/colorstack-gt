import { api } from "@colorstack-gt/backend/convex/_generated/api";
import { createFileRoute, Link, Navigate, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { type MouseEvent, type ReactNode, useEffect, useLayoutEffect, useRef } from "react";

import { z } from "zod";

import { EventsPage } from "@/components/events/page";
import { Bar, Waiting } from "@/components/frame";
import { quiet, solid } from "@/components/gate";
import { FirstName, inlineLink, pin } from "@/components/onboarding/controls";
import { TASKS } from "@/components/onboarding/options";
import type { Profile } from "@/components/onboarding/screens";
import { MemberCard } from "@/components/you/card";
import { ENTER, EXIT, still } from "@/lib/motion";

export const Route = createFileRoute("/hub")({
  validateSearch: z.object({ event: z.string().optional().catch(undefined) }),
  beforeLoad: ({ context }) => {
    if (!context.isAuthenticated) throw redirect({ to: "/sign-in" });
  },
  head: () => ({ meta: [{ title: "Events · ColorStack at Georgia Tech" }] }),
  component: Hub,
});

const ENGAGE = TASKS.find((task) => task.value === "engage")!;

function Hub() {
  const me = useQuery(api.members.me);
  const { event } = Route.useSearch();

  if (me === undefined) {
    return (
      <div className="min-h-dvh bg-blue-bright">
        <Bar signOut />
        <Waiting />
      </div>
    );
  }
  if (me === null) return <Navigate to="/sign-in" replace />;
  if (!me.complete) return <Navigate to="/onboarding" search={{ gated: true }} replace />;

  if (!me.onRoster) return <Engage me={me} />;

  return <EventsPage picked={event} />;
}

// A large number anchors each step: light blue for the member's, faint for the officer's.
function Step({
  n,
  now,
  title,
  children,
}: {
  n: number;
  now?: boolean;
  title: string;
  children: ReactNode;
}) {
  return (
    <li
      aria-current={now ? "step" : undefined}
      className="grid grid-cols-[auto_minmax(0,1fr)] content-center items-center gap-x-5 rounded-3xl bg-navy/36 px-5 py-4 roomy:px-6 roomy:py-5"
    >
      <span
        className={`row-span-2 type-heading text-5xl leading-none tracking-[-0.02em] tabular-nums roomy:text-6xl ${now ? "text-burdell" : "text-diploma/35"}`}
      >
        {n}
      </span>
      <span className="font-display text-subtitle/[1.25] font-semibold">{title}</span>
      <span className="mt-1 text-fine/[1.45] text-pretty text-diploma/70 roomy:text-label/[1.45]">
        {children}
      </span>
    </li>
  );
}

// Until an officer adds the member to the Engage roster, the hub is this page: the card they already hold, the two
// steps, and a way back to their answers.
function Engage({ me }: { me: Profile }) {
  const navigate = useNavigate();
  const page = useRef<HTMLElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  // The page rises in as each question does, and its title takes focus so the arrival is announced. A pinned
  // button only fades, since moving it would carry it off the bottom of the screen.
  const move = (enter: boolean) =>
    Array.from(page.current?.children ?? [], (el) => {
      const fixed = getComputedStyle(el).position === "fixed";
      const away = fixed ? "none" : `translateY(${enter ? 16 : -12}px)`;
      const frames = [
        { opacity: 0, transform: away },
        { opacity: 1, transform: "none" },
      ];
      return el.animate(enter ? frames : frames.reverse(), {
        duration: enter ? 300 : 140,
        easing: enter ? ENTER : EXIT,
        fill: enter ? "none" : "forwards",
      });
    });
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    if (!still()) move(true);
    title.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    const was = document.title;
    const mine = "Welcome · ColorStack at Georgia Tech";
    document.title = mine;
    return () => {
      if (document.title === mine) document.title = was;
    };
  }, []);
  // Leaving to change answers, the page goes the way a question does before the list arrives.
  async function change(event: MouseEvent) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (!still()) await Promise.all(move(false).map((a) => a.finished.catch(() => {})));
    void navigate({ to: "/onboarding", search: { edit: true } });
  }
  const first = me.name?.firstName ?? "";
  const name = `${me.name?.firstName ?? ""} ${me.name?.lastName ?? ""}`.trim();
  const since = me.joinedAt
    ? new Date(me.joinedAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "";
  return (
    <div className="min-h-dvh bg-blue-bright px-edge">
      <Bar signOut />
      <main
        ref={page}
        className="mx-auto grid w-full max-w-gate grid-cols-[minmax(0,1fr)] pt-page pb-[calc(var(--spacing-control-lg)+5rem)] [@media(max-height:499px)]:pb-7 max-lg:tall:pb-7 lg:min-h-dvh lg:max-w-none lg:grid-cols-[repeat(2,var(--container-gate))] lg:content-center lg:justify-center lg:gap-x-8 lg:pt-[calc(var(--spacing-bar)+16px)] lg:pb-[calc(var(--spacing-bar)-2rem)]"
      >
        <div className="lg:col-start-1 lg:row-start-2 [@media(max-height:499px)]:max-w-64">
          <MemberCard seed={me.gtEmail} name={name} since={since} />
        </div>
        <h1
          ref={title}
          tabIndex={-1}
          className="@container mt-6 type-display text-title text-balance wrap-break-word hyphens-auto outline-none lg:col-span-2 lg:row-start-1 lg:mt-0 lg:mb-8"
        >
          Welcome to <span className="hyphens-none">ColorStack</span>, <FirstName name={first} />
        </h1>
        <ol className="mt-6 grid gap-3 lg:col-start-2 lg:row-start-2 lg:mt-0 lg:grid-rows-2">
          <Step n={1} now title="Join us on Engage">
            Georgia Tech’s site for student organizations.
          </Step>
          <Step n={2} title="An officer adds you to the roster">
            By hand. Events and You open once you’re on it. Already on it?{" "}
            <a
              href="mailto:colorstackgt@gmail.com"
              className={`${inlineLink} whitespace-nowrap focus-visible:outline-offset-2`}
            >
              Email the e-board
            </a>
            .
          </Step>
        </ol>
        <div
          data-pin
          className={`${pin} max-lg:tall:static max-lg:tall:mt-6 max-lg:tall:bg-transparent max-lg:tall:p-0 max-lg:tall:before:hidden lg:static lg:col-start-2 lg:row-start-3 lg:mt-8 lg:bg-transparent lg:p-0 lg:before:hidden [@media(max-height:499px)]:static [@media(max-height:499px)]:mt-6 [@media(max-height:499px)]:bg-transparent [@media(max-height:499px)]:p-0 [@media(max-height:499px)]:before:hidden`}
        >
          <a
            href={ENGAGE.href}
            target="_blank"
            rel="noreferrer"
            className={`${solid} mx-auto max-w-gate gap-2`}
          >
            Open Engage
            <i aria-hidden className="ic out size-5" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </div>
        <Link
          to="/onboarding"
          search={{ edit: true }}
          onClick={change}
          className={`${quiet} mt-3 justify-self-center lg:col-start-1 lg:row-start-3 lg:mt-8 lg:min-h-control-lg lg:justify-self-stretch`}
        >
          Change your answers
        </Link>
      </main>
    </div>
  );
}
