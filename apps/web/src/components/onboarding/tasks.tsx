import { api } from "@colorstack-gt/backend/convex/_generated/api";
import { useMutation } from "convex/react";

import { Marker } from "../marker";
import { TASKS, type Task } from "./options";
import type { Profile } from "./screens";

export function doneTasks(me: Profile): Task[] {
  return TASKS.filter((task) =>
    task.value === "engage" ? me.onRoster : me.tasksDone.includes(task.value),
  ).map((task) => task.value);
}

export function pendingTasks(me: Profile): Task[] {
  const done = doneTasks(me);
  return me.tasksDone.filter((task) => !done.includes(task));
}

const LINK_LABEL = { open: "Open →", pending: "In progress →", done: "Done" } as const;

export const muted = (onInk?: boolean) => (onInk ? "text-navy/55" : "text-diploma/86");

export function TaskLink({
  task,
  label,
  onInk,
  className = "",
}: {
  task: (typeof TASKS)[number];
  label: string;
  onInk?: boolean;
  className?: string;
}) {
  const complete = useMutation(api.members.completeTask);

  return (
    <a
      href={task.href}
      target="_blank"
      rel="noreferrer"
      onClick={() => void complete({ task: task.value })}
      className={`inline-flex h-control-sm items-center rounded-full border px-4.5 type-micro pointer-coarse:h-control-touch ${
        onInk
          ? "border-navy/55 text-navy hover:border-navy"
          : "border-diploma/55 text-diploma hover:border-burdell hover:text-burdell"
      } ${className}`}
    >
      {label}
    </a>
  );
}

export function TaskList({
  done,
  pending = [],
  tasks = TASKS,
  required,
}: {
  done: readonly Task[];
  pending?: readonly Task[];
  tasks?: readonly (typeof TASKS)[number][];
  required?: boolean;
}) {
  return (
    <ol className="-mx-edge">
      {tasks.map((task) => {
        const isDone = done.includes(task.value);
        const state = isDone ? "done" : pending.includes(task.value) ? "pending" : "open";
        const onInk = Boolean(required);

        return (
          <li
            key={task.value}
            className={`flex items-center gap-4.5 px-edge py-[clamp(16px,2.2vh,24px)] ${
              required ? "bg-burdell text-navy" : ""
            }`}
          >
            <Marker state={isDone ? "done" : state === "pending" ? "now" : "todo"} onInk={onInk} />
            <div className="min-w-0 flex-1">
              <h2 className="flex flex-wrap items-center gap-3 type-heading text-item-title">
                {task.title}
                {required ? (
                  <span className="rounded-full bg-navy/14 px-2.75 py-1 type-micro text-navy">
                    Required
                  </span>
                ) : null}
              </h2>
              <p className={`mt-1.25 text-item ${muted(onInk)}`}>{task.detail}</p>
            </div>
            {isDone ? (
              <span className={`flex-none type-micro ${muted(onInk)}`}>{LINK_LABEL.done}</span>
            ) : (
              <TaskLink task={task} label={LINK_LABEL[state]} onInk={onInk} className="flex-none" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
