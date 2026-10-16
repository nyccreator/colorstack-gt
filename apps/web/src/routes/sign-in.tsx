import { createFileRoute, redirect } from "@tanstack/react-router";

import { Gate, gateSearch } from "@/components/gate";

export const Route = createFileRoute("/sign-in")({
  validateSearch: gateSearch,
  beforeLoad: ({ context }) => {
    if (context.isAuthenticated) throw redirect({ to: "/onboarding" });
  },
  head: () => ({ meta: [{ title: "Sign in · ColorStack at Georgia Tech" }] }),
  component: SignIn,
});

function SignIn() {
  const { email, sent } = Route.useSearch();
  return <Gate variant="sign-in" email={email} sent={sent} />;
}
