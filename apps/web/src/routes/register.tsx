import { isGeorgiaTechEmail } from "@colorstack-gt/backend/convex/lib/identity";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { RegisterForm } from "@/components/register/form";
import { Shell } from "@/components/shell";

const searchSchema = z.object({
  email: z.email().refine(isGeorgiaTechEmail).optional().catch(undefined),
});

export const Route = createFileRoute("/register")({
  validateSearch: searchSchema,
  component: Register,
});

function Register() {
  const { email } = Route.useSearch();

  return (
    <Shell>
      <RegisterForm email={email} />
    </Shell>
  );
}
