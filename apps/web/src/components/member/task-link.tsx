import { api } from "@colorstack-gt/backend/convex/_generated/api";
import { useMutation } from "convex/react";

import { type Task, TASKS } from "../onboarding/options";

export function TaskLink({
  task,
  logo,
  title = TASKS[task].title,
  short,
}: {
  task: Task;
  logo: string;
  title?: string;
  short?: string;
}) {
  const completeTask = useMutation(api.members.completeTask);
  const record = () => void completeTask({ task });
  return (
    <a
      className="lnk"
      href={TASKS[task].href}
      target="_blank"
      rel="noreferrer"
      onClick={record}
      onAuxClick={(event) => event.button === 1 && record()}
    >
      <img className="st" src={logo} alt="" />
      <span className="txt">
        <b>{title}</b>
        <span>{TASKS[task].detail}</span>
      </span>
      {short ? (
        <span className="short" aria-hidden>
          {short}
        </span>
      ) : null}
      <i className="ic out" aria-hidden />
    </a>
  );
}
