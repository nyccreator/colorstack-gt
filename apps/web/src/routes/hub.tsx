import { api } from "@colorstack-gt/backend/convex/_generated/api";
import { createFileRoute, Navigate, redirect } from "@tanstack/react-router";
import { useQuery } from "convex/react";

import { Bar, Frame } from "@/components/frame";
import { Heading } from "@/components/heading";
import { Mark } from "@/components/mark";
import { Marker } from "@/components/marker";
import { inlineLink, primaryButton } from "@/components/onboarding/controls";
import { TASKS } from "@/components/onboarding/options";
import { doneTasks, muted, TaskLink } from "@/components/onboarding/tasks";

export const Route = createFileRoute("/hub")({
  beforeLoad: ({ context }) => {
    if (!context.isAuthenticated) throw redirect({ to: "/sign-in" });
  },
  component: Hub,
});

const ENGAGE = TASKS.find((task) => task.value === "engage")!;
const EXTRAS = TASKS.filter((task) => task.value !== "engage");

const GROUNDS = ["bg-navy text-diploma", "bg-diploma text-navy", "bg-burdell text-navy"] as const;

function Hub() {
  const me = useQuery(api.members.me);

  if (me === undefined) return <Frame signOut>{null}</Frame>;
  if (me === null) return <Navigate to="/sign-in" />;
  if (!me.complete) return <Navigate to="/onboarding" search={{ gated: true }} />;

  if (!me.onRoster) {
    return (
      <Frame signOut art={<Mark mark="wreck" className="w-[min(62%,26rem)]" />}>
        <Heading
          eyebrow="One more step"
          title="Join us on Engage."
          lede="The hub opens once you're on our Engage roster. We check the roster by hand, so it can take a little while after you join."
        />
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
          <a href="mailto:colorstackgt@gmail.com" className={inlineLink}>
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
          <Heading
            eyebrow="Your hub"
            title={`Hi, ${me.name?.firstName}.`}
            lede="You're all set. A few optional extras:"
          />
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
              <div className="flex gap-3">
                <span className="flex h-lh flex-none items-center text-item-title">
                  <Marker state={isDone ? "done" : "todo"} onInk={onInk} />
                </span>
                <div className="min-w-0">
                  <h2 className="type-heading text-item-title">{task.title}</h2>
                  <p className={`mt-2 text-item ${muted(onInk)}`}>{task.detail}</p>
                </div>
              </div>
              <TaskLink
                task={task}
                label={isDone ? "Open again →" : "Open →"}
                onInk={onInk}
                className="w-fit"
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
