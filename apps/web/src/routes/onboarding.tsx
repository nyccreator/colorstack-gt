import { api } from "@colorstack-gt/backend/convex/_generated/api";
import { createFileRoute, Navigate, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { useState } from "react";
import { z } from "zod";

import { Frame } from "@/components/frame";
import { Heading } from "@/components/heading";
import { Marker } from "@/components/marker";
import { Footbar } from "@/components/onboarding/controls";
import { STAGES, TASKS } from "@/components/onboarding/options";
import { type Profile, Rail, SCREENS } from "@/components/onboarding/screens";
import { doneTasks, pendingTasks, TaskList } from "@/components/onboarding/tasks";

const searchSchema = z.object({
  gated: z.boolean().optional().catch(undefined),
});

export const Route = createFileRoute("/onboarding")({
  validateSearch: searchSchema,
  beforeLoad: ({ context }) => {
    if (!context.isAuthenticated) throw redirect({ to: "/sign-in" });
  },
  component: Onboarding,
});

type Status = "done" | "skipped" | "todo";

function statuses(me: Profile): Status[] {
  const passed = (index: number) => me.step > index;
  return [
    me.name ? "done" : "todo",
    me.contact ? "done" : "todo",
    me.studies ? "done" : "todo",
    me.materials || me.resume ? "done" : passed(3) ? "skipped" : "todo",
    me.reported ? "done" : "todo",
    me.interests ? "done" : passed(5) ? "skipped" : "todo",
  ];
}

const STATUS_LABEL = { done: "", skipped: "Optional", todo: "", next: "Next" } as const;

function Stages({
  me,
  gated,
  next,
  onResume,
}: {
  me: Profile;
  gated: boolean;
  next: number;
  onResume: () => void;
}) {
  const status = statuses(me);

  return (
    <Frame
      signOut
      anchor="high"
      rail={<Rail index={next} />}
      footer={
        <Footbar
          step={next}
          total={STAGES.length}
          forward={{
            label: gated ? "Finish setup" : "Pick up where I left off",
            onClick: onResume,
          }}
        />
      }
    >
      <Heading
        eyebrow={gated ? "Not yet" : "Welcome back"}
        title={gated ? "A few things first." : "You left off partway."}
        size="step"
      />
      <ol className="mt-8 grid max-w-150 gap-4.5">
        {STAGES.map((stage, index) => {
          const state =
            index === next && status[index] === "todo" ? "next" : (status[index] ?? "todo");
          const label = STATUS_LABEL[state];
          return (
            <li key={stage.title} className="flex items-center gap-4.5">
              <Marker state={state === "done" ? "done" : state === "next" ? "now" : "todo"} />
              <h2 className="min-w-0 flex-1 type-heading text-stage">{stage.title}</h2>
              {label ? (
                <span
                  className={`flex-none type-micro ${
                    state === "next" ? "text-burdell" : "text-diploma/86"
                  }`}
                >
                  {label}
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </Frame>
  );
}

function Done({ me, onHub }: { me: Profile; onHub: () => void }) {
  const done = doneTasks(me);
  const engage = TASKS.filter((task) => task.value === "engage");
  const extras = TASKS.filter((task) => task.value !== "engage");
  const openedEngage = me.onRoster || me.tasksDone.includes("engage");
  return (
    <Frame
      signOut
      wide
      footer={
        <Footbar forward={{ label: "Go to my hub", onClick: onHub, disabled: !openedEngage }} />
      }
    >
      <Heading eyebrow="Profile complete" title="You're in." size="step" />
      <p className="mt-7 mb-2.5 type-micro text-diploma/86">Required to open your hub</p>
      <TaskList done={done} pending={pendingTasks(me)} tasks={engage} required />
      <p className="mt-6 mb-2.5 type-micro text-diploma/86">A few optional extras</p>
      <TaskList done={done} tasks={extras} />
    </Frame>
  );
}

function Onboarding() {
  const me = useQuery(api.members.me);
  const { gated } = Route.useSearch();
  const navigate = useNavigate();
  const [view, setView] = useState<number | "stages" | "done" | null>(null);

  if (me === undefined) return <Frame signOut>{null}</Frame>;
  if (me === null) return <Navigate to="/sign-in" />;
  if (view === null && me.complete) return <Navigate to="/hub" />;

  const next = Math.max(0, statuses(me).indexOf("todo"));
  const current = view ?? (me.step === 0 && !gated ? 0 : "stages");

  if (current === "done") return <Done me={me} onHub={() => void navigate({ to: "/hub" })} />;
  if (current === "stages") {
    return <Stages me={me} gated={Boolean(gated)} next={next} onResume={() => setView(next)} />;
  }

  const Screen = SCREENS[current];
  if (!Screen) return <Navigate to="/hub" />;

  return (
    <Screen
      key={current}
      me={me}
      onBack={current > 0 ? () => setView(current - 1) : undefined}
      onNext={() =>
        setView(current + 1 < SCREENS.length ? current + 1 : me.complete ? "done" : "stages")
      }
    />
  );
}
