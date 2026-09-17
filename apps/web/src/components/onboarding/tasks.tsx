import { api } from "@colorstack-gt/backend/convex/_generated/api";
import { useMutation } from "convex/react";

import type { Profile } from "./screens";
import { TASKS, type Task } from "./options";

export function doneTasks(me: Profile): Task[] {
  return TASKS.filter((task) =>
    task.value === "engage" ? me.onRoster : me.tasksDone.includes(task.value),
  ).map((task) => task.value);
}

export function pendingTasks(me: Profile): Task[] {
  const done = doneTasks(me);
  return me.tasksDone.filter((task) => !done.includes(task));
}

const LINK_STYLE = {
  open: "text-diploma inset-ring inset-ring-diploma/22",
  pending: "text-burdell inset-ring inset-ring-burdell/40",
  done: "bg-diploma/10 text-diploma/52",
} as const;

const LINK_LABEL = { open: "Open →", pending: "In progress →", done: "Done →" } as const;

export function TaskList({
  done,
  pending = [],
  tasks = TASKS,
}: {
  done: readonly Task[];
  pending?: readonly Task[];
  tasks?: readonly (typeof TASKS)[number][];
}) {
  const complete = useMutation(api.members.completeTask);

  return (
    <ol className="mt-1.5 max-w-150">
      {tasks.map((task, index) => {
        const isDone = done.includes(task.value);
        const state = isDone ? "done" : pending.includes(task.value) ? "pending" : "open";
        return (
          <li
            key={task.value}
            className="flex items-start gap-3.5 border-t border-diploma/14 py-3.5 last:border-b"
          >
            <span className="mt-0.75 font-mono text-label text-gold">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="type-heading text-item-title">{task.title}</h2>
              <p className="mt-0.75 text-hint text-diploma/52">{task.detail}</p>
            </div>
            <a
              href={task.href}
              target="_blank"
              rel="noreferrer"
              onClick={() => {
                if (!isDone) void complete({ task: task.value });
              }}
              className={`inline-flex h-control-sm flex-none items-center px-3.5 type-label hover:text-burdell pointer-coarse:h-control-touch ${LINK_STYLE[state]}`}
            >
              {LINK_LABEL[state]}
            </a>
          </li>
        );
      })}
    </ol>
  );
}
