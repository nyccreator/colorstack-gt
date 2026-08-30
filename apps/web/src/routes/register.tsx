import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { Shell } from "@/components/shell";

const searchSchema = z.object({
  email: z.email().optional().catch(undefined),
});

export const Route = createFileRoute("/register")({
  validateSearch: searchSchema,
  component: Register,
});

function Register() {
  const { email } = Route.useSearch();

  return (
    <Shell>
      <div>
        <div className="relative flex min-h-dvh flex-col justify-center bg-navy px-6 py-10 text-neutral-ink-cream">
          <div className="wash-register" />
          <div className="relative">
            <p className="type-label text-neutral-muted-navy">Step 03</p>
            <h1 className="mt-4 type-display text-page">
              Become a <span className="text-gold italic">member</span>
            </h1>
            <p className="mt-6 text-subhead leading-copy text-neutral-body-navy">
              {email ? `Registration will start with ${email}.` : "Registration is not built yet."}
            </p>
          </div>
        </div>
      </div>
    </Shell>
  );
}
