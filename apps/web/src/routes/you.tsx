import { createFileRoute } from "@tanstack/react-router";

import { Bar, Pages, Waiting } from "@/components/frame";
import { YouPage } from "@/components/you/page";
import { useMember } from "@/lib/member";
import { requireSession } from "@/lib/session";

export const Route = createFileRoute("/you")({
  beforeLoad: requireSession,
  head: () => ({ meta: [{ title: "You · ColorStack at Georgia Tech" }] }),
  component: You,
});

function You() {
  const member = useMember("roster");

  if (member.status !== "ready") {
    return (
      <div className="you">
        <Bar signOut nav={<Pages />} className="bar" />
        <Waiting />
        <Pages dock />
      </div>
    );
  }

  return <YouPage me={member.me} answers={member.answers} />;
}
