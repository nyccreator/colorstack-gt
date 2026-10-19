import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { type MouseEvent, type ReactNode, useEffect, useLayoutEffect, useRef } from "react";

import { z } from "zod";

import { EventsPage } from "@/components/events/page";
import { Bar, Waiting } from "@/components/frame";
import { containerTitle, FirstName, inlineLink, pin } from "@/components/onboarding/controls";
import { TASKS } from "@/components/onboarding/options";
import { MemberCard } from "@/components/you/card";
import { type Profile, useMember } from "@/lib/member";
import { slide } from "@/lib/motion";
import { requireSession } from "@/lib/session";

export const Route = createFileRoute("/hub")({
  validateSearch: z.object({ event: z.string().optional().catch(undefined) }),
  beforeLoad: requireSession,
  head: () => ({ meta: [{ title: "Events · ColorStack at Georgia Tech" }] }),
  component: Hub,
});

const ENGAGE = TASKS.engage;

function Hub() {
  const member = useMember("complete");
  const { event } = Route.useSearch();

  if (member.status !== "ready") {
    return (
      <div className="min-h-dvh bg-blue-bright">
        <Bar signOut />
        <Waiting />
      </div>
    );
  }

  if (!member.me.onRoster) return <Engage me={member.me} />;

  return <EventsPage picked={event} />;
}

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
        className={`row-span-2 type-display text-5xl leading-none tracking-[-0.02em] tabular-nums roomy:text-6xl ${now ? "text-burdell" : "text-diploma/35"}`}
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

function Engage({ me }: { me: Profile }) {
  const navigate = useNavigate();
  const page = useRef<HTMLElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const leaving = useRef(false);
  const move = (enter: boolean) =>
    Array.from(page.current?.children ?? [], (el) => slide(el, enter));
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    move(true);
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
  async function change(event: MouseEvent) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (leaving.current) return;
    leaving.current = true;
    await Promise.all(move(false).map((a) => a.finished.catch(() => {})));
    void navigate({ to: "/onboarding", search: { edit: true } });
  }
  const first = me.name?.firstName ?? "";
  return (
    <div className="min-h-dvh bg-blue-bright px-edge">
      <Bar signOut />
      <main
        ref={page}
        className="mx-auto grid w-full max-w-gate grid-cols-[minmax(0,1fr)] pt-page pb-pinned short:pb-7 max-lg:tall:pb-7 lg:min-h-dvh lg:max-w-none lg:grid-cols-[repeat(2,var(--container-gate))] lg:content-center lg:justify-center lg:gap-x-8 lg:pt-[calc(var(--spacing-bar)+16px)] lg:pb-[calc(var(--spacing-bar)-2rem)]"
      >
        <div className="lg:col-start-1 lg:row-start-2 short:max-w-64">
          <MemberCard me={me} />
        </div>
        <h1
          ref={title}
          tabIndex={-1}
          className={`${containerTitle} mt-6 lg:col-span-2 lg:row-start-1 lg:mt-0 lg:mb-8`}
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
          className={`${pin} max-lg:tall:unpinned max-lg:tall:mt-6 lg:unpinned lg:col-start-2 lg:row-start-3 lg:mt-8 short:unpinned short:mt-6`}
        >
          <a
            href={ENGAGE.href}
            target="_blank"
            rel="noreferrer"
            className="btn-solid mx-auto max-w-gate gap-2"
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
          className="btn-quiet mt-3 justify-self-center lg:col-start-1 lg:row-start-3 lg:mt-8 lg:min-h-control-lg lg:justify-self-stretch"
        >
          Change your answers
        </Link>
      </main>
    </div>
  );
}
