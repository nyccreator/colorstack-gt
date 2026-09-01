import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";

import { Lockup } from "@/components/lockup";
import { Shell } from "@/components/shell";

const searchSchema = z.object({
  token: z.string().optional().catch(undefined),
  callbackURL: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/verify")({
  validateSearch: searchSchema,
  component: Verify,
});

/**
 * Holds the magic link token until a person clicks. Mail scanners fetch links
 * before delivery, and a fetch of this page does not spend the token.
 */
function Verify() {
  const { token, callbackURL } = Route.useSearch();
  const [pending, setPending] = useState(false);

  function confirm() {
    if (!token) return;
    setPending(true);
    const query = new URLSearchParams({ token, callbackURL: callbackURL ?? "/" });
    window.location.href = `/api/auth/magic-link/verify?${query}`;
  }

  return (
    <Shell>
      <div className="relative flex min-h-dvh flex-col px-6 py-5 md:px-9 md:py-6">
        <div className="wash-login" />

        <div className="relative">
          <Lockup />
        </div>

        <div className="relative flex flex-1 items-center">
          <div className="max-w-[50ch] py-12">
            {token ? (
              <>
                <h1 className="type-display text-page">
                  Confirm your <span className="text-gold italic">sign in</span>
                </h1>
                <p className="mt-6 text-subhead leading-copy text-neutral-body-navy">
                  Tap below to finish signing in to ColorStack at Georgia Tech.
                </p>
                <button
                  type="button"
                  onClick={confirm}
                  disabled={pending}
                  className="mt-8 cursor-pointer rounded-pill bg-buzz px-8 py-4 text-body font-semibold text-navy hover:opacity-[0.88] disabled:cursor-wait disabled:opacity-70"
                >
                  {pending ? "One moment…" : "Confirm sign in"}
                </button>
                <div className="mt-8 rounded-content border border-gold/22 px-5 py-4">
                  <p className="text-detail leading-copy text-neutral-body-navy">
                    This link expires 15 minutes after it was sent and works once.
                  </p>
                </div>
              </>
            ) : (
              <>
                <h1 className="type-display text-page">
                  Link is <span className="text-gold italic">incomplete</span>
                </h1>
                <p className="mt-6 text-subhead leading-copy text-neutral-body-navy">
                  Open the most recent link from your email, or request a new one.
                </p>
                <Link
                  to="/"
                  className="mt-8 inline-block rounded-pill bg-buzz px-8 py-4 text-body font-semibold text-navy hover:opacity-[0.88]"
                >
                  Back to site
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </Shell>
  );
}
