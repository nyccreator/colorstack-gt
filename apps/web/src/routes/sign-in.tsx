import { createFileRoute, redirect } from "@tanstack/react-router";

import { Gate } from "@/components/gate";

export const Route = createFileRoute("/sign-in")({
  beforeLoad: ({ context }) => {
    if (context.isAuthenticated) throw redirect({ to: "/onboarding" });
  },
  component: () => <Gate variant="sign-in" />,
});
