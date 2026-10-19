import { createFileRoute } from "@tanstack/react-router";

import { Gate, gateSearch } from "@/components/gate";
import { guestOnly } from "@/lib/session";

export const Route = createFileRoute("/_gate/join")({
  validateSearch: gateSearch,
  beforeLoad: guestOnly,
  head: () => ({ meta: [{ title: "Join · ColorStack at Georgia Tech" }] }),
  component: Join,
});

function Join() {
  const { email, sent, redirect } = Route.useSearch();
  return <Gate variant="join" email={email} sent={sent} redirect={redirect} />;
}
