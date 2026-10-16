import { createFileRoute, redirect } from "@tanstack/react-router";

import { Gate, gateSearch } from "@/components/gate";

export const Route = createFileRoute("/join")({
  validateSearch: gateSearch,
  beforeLoad: ({ context }) => {
    if (context.isAuthenticated) throw redirect({ to: "/onboarding" });
  },
  head: () => ({ meta: [{ title: "Join · ColorStack at Georgia Tech" }] }),
  component: Join,
});

function Join() {
  const { email, sent } = Route.useSearch();
  return <Gate variant="join" email={email} sent={sent} />;
}
