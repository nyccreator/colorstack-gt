import { api } from "@colorstack-gt/backend/convex/_generated/api";
import { createFileRoute, Navigate, redirect } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";

import { Bar, Frame } from "@/components/frame";
import { Mark } from "@/components/mark";
import { Marker } from "@/components/marker";
import { primaryButton } from "@/components/onboarding/controls";
import { TASKS } from "@/components/onboarding/options";
import { doneTasks } from "@/components/onboarding/tasks";

export const Route = createFileRoute("/hub")({
  beforeLoad: ({ context }) => {
    if (!context.isAuthenticated) throw redirect({ to: "/sign-in" });
  },
  component: Hub,
});

const ENGAGE = TASKS.find((task) => task.value === "engage")!;
const EXTRAS = TASKS.filter((task) => task.value !== "engage");

const linkClass = "border-b border-current pb-px text-diploma hover:text-burdell";

const GROUNDS = ["bg-navy text-diploma", "bg-diploma text-navy", "bg-burdell text-navy"] as const;

function Hub() {
  const me = useQuery(api.members.me);
  const complete = useMutation(api.members.completeTask);

  if (me === undefined) return <Frame signOut>{null}</Frame>;
  if (me === null) return <Navigate to="/sign-in" />;
  if (!me.complete) return <Navigate to="/onboarding" search={{ gated: true }} />;

  if (!me.onRoster) {
    return (
      <Frame signOut art={<Mark mark="wreck" className="w-[min(62%,26rem)]" />}>
        <p className="type-eyebrow text-diploma/86">One more step</p>
        <h1 className="mt-3.5 type-display text-gate">Join us on Engage.</h1>
        <p className="mt-4.5 max-w-[46ch] text-lede-gate text-diploma/86">
          The hub opens once you're on our Engage roster. We check the roster by hand, so it can
          take a little while after you join.
        </p>
        <a
          href={ENGAGE.href}
          target="_blank"
          rel="noreferrer"
          className={`${primaryButton} mt-8 self-start`}
        >
          Join on Engage
        </a>
        <p className="mt-7 max-w-[46ch] text-note text-diploma/86">
          Already on the roster?{" "}
          <a href="mailto:colorstackgt@gmail.com" className={linkClass}>
            Email the e-board
          </a>
          .
        </p>
      </Frame>
    );
  }

  const done = doneTasks(me);

  return (
    <div className="grid min-h-dvh grid-rows-[auto_auto] bg-blue-bright shell:grid-rows-[minmax(0,1fr)_minmax(0,0.9fr)]">
      <Bar signOut />

      <div className="flex flex-col justify-start px-edge pt-[calc(var(--spacing-bar)+clamp(28px,7vh,64px))] pb-[clamp(20px,4vh,44px)] shell:pt-anchor-low">
        <div className="w-full max-w-column">
          <p className="type-eyebrow text-diploma/86">Your hub</p>
          <h1 className="mt-3.5 type-display text-gate">Hi, {me.name?.firstName}.</h1>
          <p className="mt-4.5 max-w-[46ch] text-lede-gate text-diploma/86">
            You're all set. A few optional extras:
          </p>
        </div>
      </div>

      <ul className="grid min-h-0 grid-cols-1 shell:grid-cols-3">
        {EXTRAS.map((task, index) => {
          const isDone = done.includes(task.value);
          const ground = GROUNDS[index] ?? GROUNDS[0];
          const onInk = index > 0;

          return (
            <li
              key={task.value}
              className={`flex min-w-0 flex-col justify-between gap-4.5 p-[clamp(20px,2.6vw,34px)] first:pl-edge last:pr-edge max-shell:px-edge ${ground}`}
            >
              <div>
                <div className="flex items-center gap-3">
                  <Marker state={isDone ? "done" : "todo"} onInk={onInk} />
                  <h2 className="type-heading text-item-title">{task.title}</h2>
                </div>
                <p className={`mt-2 text-item ${onInk ? "text-navy/55" : "text-diploma/86"}`}>
                  {task.detail}
                </p>
              </div>
              {isDone ? (
                <span className={`type-micro ${onInk ? "text-navy/55" : "text-diploma/86"}`}>
                  Done
                </span>
              ) : (
                <a
                  href={task.href}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => void complete({ task: task.value })}
                  className={`inline-flex h-control-sm w-fit items-center rounded-full border px-4.5 type-micro pointer-coarse:h-control-touch ${
                    onInk
                      ? "border-navy/55 text-navy hover:border-navy"
                      : "border-diploma/55 text-diploma hover:border-burdell hover:text-burdell"
                  }`}
                >
                  Open →
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
