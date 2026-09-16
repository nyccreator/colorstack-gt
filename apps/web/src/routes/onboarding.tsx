import { api } from "@colorstack-gt/backend/convex/_generated/api";
import { createFileRoute, Navigate, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { useState } from "react";
import { z } from "zod";

import { Frame } from "@/components/frame";
import { Footbar } from "@/components/onboarding/controls";
import { STAGES, TASKS } from "@/components/onboarding/options";
import { type Profile, SCREENS } from "@/components/onboarding/screens";
import { doneTasks, TaskList } from "@/components/onboarding/tasks";

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

function detail(me: Profile, index: number): string {
  if (index === 0 && me.name)
    return `${me.name.firstName} ${me.name.lastName} · ${me.name.pronouns}`;
  if (index === 1 && me.contact) return `${me.contact.personalEmail} · ${me.contact.phone}`;
  return STAGES[index]?.detail ?? "";
}

const STATUS_LABEL = { done: "Done", skipped: "Skipped", todo: "—", next: "Next" } as const;

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
      <p className="mb-3 type-eyebrow text-diploma/52">{gated ? "Not yet" : "Welcome back"}</p>
      <h1 className="type-display text-step">
        {gated ? "A few things first." : "You left off partway."}
      </h1>
      <ol className="mt-1.5 max-w-150">
        {STAGES.map((stage, index) => {
          const state =
            index === next && status[index] === "todo" ? "next" : (status[index] ?? "todo");
          return (
            <li
              key={stage.title}
              className="flex items-baseline gap-3.5 border-t border-diploma/14 py-3 last:border-b"
            >
              <span className="w-4 flex-none font-mono text-label text-gold">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="type-heading text-stage">{stage.title}</h2>
                <p className="mt-0.75 truncate text-hint text-diploma/52">{detail(me, index)}</p>
              </div>
              <span
                className={`flex-none type-label ${
                  state === "done"
                    ? "text-diploma"
                    : state === "next"
                      ? "text-buzz"
                      : "text-diploma/52"
                }`}
              >
                {STATUS_LABEL[state]}
              </span>
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
  return (
    <Frame signOut footer={<Footbar forward={{ label: "Go to my hub", onClick: onHub }} />}>
      <p className="mb-3 type-eyebrow text-diploma/52">Profile complete</p>
      <h1 className="type-display text-step">You're in.</h1>
      <p className="mt-3 mb-4 text-note text-diploma/72">Required to open your hub:</p>
      <TaskList done={done} tasks={engage} />
      <p className="mt-6 mb-4 text-note text-diploma/72">A few optional extras:</p>
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
