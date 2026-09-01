import { api } from "@colorstack-gt/backend/convex/_generated/api";
import { createFileRoute, redirect, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { useState } from "react";

import { Lockup } from "@/components/lockup";
import { Shell } from "@/components/shell";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/portal")({
  beforeLoad: ({ context }) => {
    if (!context.isAuthenticated) throw redirect({ to: "/login" });
  },
  component: Portal,
});

function Portal() {
  const router = useRouter();
  const navigate = useNavigate();
  const member = useQuery(api.members.me);
  const [pending, setPending] = useState(false);

  const firstName = member?.firstName;

  async function signOut() {
    setPending(true);
    await authClient.signOut();
    await navigate({ to: "/" });
    await router.invalidate();
  }

  return (
    <Shell>
      <div className="relative flex min-h-dvh flex-col px-6 py-5 md:px-9 md:py-6">
        <div className="wash-login" />

        <nav className="relative flex flex-wrap items-center justify-between gap-4">
          <Lockup />
          <button
            type="button"
            onClick={signOut}
            disabled={pending}
            className="cursor-pointer type-label text-gold disabled:cursor-wait disabled:opacity-70"
          >
            Log out &#8594;
          </button>
        </nav>

        <div className="relative flex flex-1 items-center">
          <div className="w-full max-w-capsule py-12">
            <h1 className="type-display text-portal">
              Member <span className="text-gold italic">portal</span>
            </h1>
            <p className="mt-6 text-subhead leading-copy text-neutral-body-navy">
              Welcome{firstName ? ` ${firstName}` : ""}! Member portal coming soon.
            </p>
          </div>
        </div>
      </div>
    </Shell>
  );
}
