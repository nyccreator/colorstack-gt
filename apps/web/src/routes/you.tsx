import { api } from "@colorstack-gt/backend/convex/_generated/api";
import { createFileRoute, Navigate, redirect } from "@tanstack/react-router";
import { useQuery } from "convex/react";

import { Bar, Pages, Waiting } from "@/components/frame";
import { YouPage } from "@/components/you/page";

export const Route = createFileRoute("/you")({
  beforeLoad: ({ context }) => {
    if (!context.isAuthenticated) throw redirect({ to: "/sign-in" });
  },
  head: () => ({ meta: [{ title: "You · ColorStack at Georgia Tech" }] }),
  component: You,
});

function You() {
  const me = useQuery(api.members.me);
  // The private answers arrive before the page, so Your background never opens empty.
  const answers = useQuery(api.members.myDemographics);

  if (me === null) return <Navigate to="/sign-in" />;
  if (me && !me.complete) return <Navigate to="/onboarding" search={{ gated: true }} />;
  if (me && !me.onRoster) return <Navigate to="/hub" />;
  if (me === undefined || answers === undefined) {
    return (
      <div className="you">
        <Bar signOut nav={<Pages />} className="bar" />
        <Waiting />
        <Pages dock />
      </div>
    );
  }

  return <YouPage me={me} answers={answers} />;
}
