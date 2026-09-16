import { api } from "@colorstack-gt/backend/convex/_generated/api";
import { useMutation } from "convex/react";

import type { Profile } from "./screens";
import { TASKS, type Task } from "./options";

export function doneTasks(me: Profile): Task[] {
  return TASKS.filter((task) =>
    task.value === "engage" ? me.onRoster : me.tasksDone.includes(task.value),
  ).map((task) => task.value);
}

export function TaskList({
  done,
  tasks = TASKS,
}: {
  done: readonly Task[];
  tasks?: readonly (typeof TASKS)[number][];
}) {
  const complete = useMutation(api.members.completeTask);

  return (
    <ol className="mt-1.5 max-w-150">
      {tasks.map((task, index) => {
        const isDone = done.includes(task.value);
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
                if (!isDone && task.value !== "engage") void complete({ task: task.value });
              }}
              className={`flex-none px-3.25 py-2.5 type-label hover:text-burdell ${
                isDone
                  ? "bg-diploma/10 text-diploma/52"
                  : "text-diploma inset-ring inset-ring-diploma/22"
              }`}
            >
              {isDone ? "Done →" : "Open →"}
            </a>
          </li>
        );
      })}
    </ol>
  );
}
