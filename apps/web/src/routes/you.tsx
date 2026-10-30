import { api } from "@colorstack-gt/backend/convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import { useQueries } from "convex/react";

import { Bar, Pages, Waiting } from "@/components/frame";
import { YouPage } from "@/components/you/page";
import { useMember } from "@/lib/member";
import { requireSession } from "@/lib/session";

export const Route = createFileRoute("/you")({
  beforeLoad: requireSession,
  head: () => ({ meta: [{ title: "You · ColorStack at Georgia Tech" }] }),
  component: You,
});

const EVENTS = { events: { query: api.events.list, args: {} } };

function You() {
  const member = useMember("roster");
  // Holding this subscription lets Events open with its list so Back can restore its scroll, and useQueries
  // reports a failed query where useQuery would throw it.
  useQueries(EVENTS);

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
