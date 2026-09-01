import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";

import { Lockup } from "@/components/lockup";
import { Shell } from "@/components/shell";

const searchSchema = z.object({
  status: z.enum(["saved", "exists"]).optional().catch(undefined),
  email: z.email().optional().catch(undefined),
});

export const Route = createFileRoute("/register_/done")({
  validateSearch: searchSchema,
  component: Done,
});

function Done() {
  const { status, email } = Route.useSearch();
  const address = email ?? "your Georgia Tech email";

  return (
    <Shell>
      <div className="relative flex min-h-dvh flex-col px-6 py-5 md:px-9 md:py-6">
        <div className="wash-register" />

        <div className="relative">
          <Lockup />
        </div>

        <div className="relative flex flex-1 items-center">
          <div className="max-w-[50ch] py-12">
            <h1 className="type-display text-page">
              Check your <span className="text-gold italic">email</span>
            </h1>

            {status === "exists" ? (
              <p className="mt-6 text-subhead leading-copy text-neutral-body-navy">
                You already have an account, so we sent a sign-in link to{" "}
                <span className="font-semibold text-neutral-ink-cream">{address}</span>.
              </p>
            ) : (
              <p className="mt-6 text-subhead leading-copy text-neutral-body-navy">
                We sent a link to{" "}
                <span className="font-semibold text-neutral-ink-cream">{address}</span>. Click it to
                confirm your spot.
              </p>
            )}

            <div className="mt-8 rounded-content border border-gold/22 px-5 py-4">
              <p className="text-detail leading-copy text-neutral-body-navy">
                The link expires in 15 minutes and works once. Check your junk folder if you cannot
                find it.
                {status === "exists"
                  ? ""
                  : " Sign-ups that are not confirmed within two weeks are removed."}
              </p>
            </div>

            <Link to="/" className="mt-9 inline-block type-label text-neutral-muted-navy">
              &#8592; Back to site
            </Link>
          </div>
        </div>
      </div>
    </Shell>
  );
}
