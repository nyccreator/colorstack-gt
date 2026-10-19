import { createFileRoute } from "@tanstack/react-router";

import { Gate, gateSearch } from "@/components/gate";
import { guestOnly } from "@/lib/session";

export const Route = createFileRoute("/sign-in")({
  validateSearch: gateSearch,
  beforeLoad: guestOnly,
  head: () => ({ meta: [{ title: "Sign in · ColorStack at Georgia Tech" }] }),
  component: SignIn,
});

function SignIn() {
  const { email, sent, redirect } = Route.useSearch();
  return <Gate variant="sign-in" email={email} sent={sent} redirect={redirect} />;
}
