import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

import { Gate } from "@/components/gate";

const searchSchema = z.object({
  email: z.string().optional().catch(undefined),
  sent: z.boolean().optional().catch(undefined),
});

export const Route = createFileRoute("/join")({
  validateSearch: searchSchema,
  beforeLoad: ({ context }) => {
    if (context.isAuthenticated) throw redirect({ to: "/onboarding" });
  },
  component: Join,
});

function Join() {
  const { email, sent } = Route.useSearch();
  return <Gate variant="join" email={email} sent={sent} />;
}
