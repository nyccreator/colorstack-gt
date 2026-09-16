import { api } from "@colorstack-gt/backend/convex/_generated/api";
import { createFileRoute, Navigate, redirect } from "@tanstack/react-router";
import { useQuery } from "convex/react";

import { Frame } from "@/components/frame";
import { TASKS, THINGS } from "@/components/onboarding/options";
import { doneTasks, TaskList } from "@/components/onboarding/tasks";

export const Route = createFileRoute("/hub")({
  beforeLoad: ({ context }) => {
    if (!context.isAuthenticated) throw redirect({ to: "/sign-in" });
  },
  component: Hub,
});

const ENGAGE = TASKS.find((task) => task.value === "engage")!;

const linkClass = "border-b border-buzz/40 text-buzz hover:text-burdell";

function Hub() {
  const me = useQuery(api.members.me);

  if (me === undefined) return <Frame signOut>{null}</Frame>;
  if (me === null) return <Navigate to="/sign-in" />;
  if (!me.complete) return <Navigate to="/onboarding" search={{ gated: true }} />;

  if (!me.onRoster) {
    return (
      <Frame signOut>
        <p className="mb-3 type-eyebrow text-diploma/52">One more step</p>
        <h1 className="type-display text-step">Join us on Engage.</h1>
        <p className="mt-3 max-w-[48ch] text-note text-diploma/72">
          The hub opens once you're on our Engage roster. We check the roster by hand, so it can
          take a little while after you join.
        </p>
        <a
          href={ENGAGE.href}
          target="_blank"
          rel="noreferrer"
          className="mt-5.5 inline-block bg-buzz px-5.5 py-3.5 type-button text-navy"
        >
          Join on Engage
        </a>
        <p className="mt-4 max-w-[48ch] text-note text-diploma/52">
          Already on the roster?{" "}
          <a href="mailto:board@colorstackgt.org" className={linkClass}>
            Email the e-board
          </a>
          .
        </p>
      </Frame>
    );
  }

  const done = doneTasks(me);
  const left = TASKS.length - done.length;

  return (
    <Frame signOut>
      <p className="mb-3 type-eyebrow text-diploma/52">Your hub</p>
      <h1 className="type-display text-step">Hi, {me.name?.firstName}.</h1>
      {left > 0 ? (
        <>
          <p className="mt-3 mb-4 text-note text-diploma/72">{THINGS[left]} left to set up.</p>
          <TaskList done={done} />
        </>
      ) : (
        <p className="mt-3 text-note text-diploma/72">You're all set.</p>
      )}
    </Frame>
  );
}
