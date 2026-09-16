import { api } from "@colorstack-gt/backend/convex/_generated/api";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { type ReactNode, useState } from "react";

import { authClient } from "@/lib/auth-client";

import { Mark } from "./mark";

function SignOut() {
  const me = useQuery(api.members.me);
  const router = useRouter();
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    await authClient.signOut();
    await router.invalidate();
    await navigate({ to: "/" });
  }

  return (
    <div className="absolute top-6.5 right-page z-20 flex max-w-[calc(100%-2*var(--spacing-page)-3.75rem)] items-center gap-4">
      {me ? (
        <span className="min-w-0 truncate font-mono text-hint text-diploma/72">{me.gtEmail}</span>
      ) : null}
      <button
        type="button"
        onClick={signOut}
        disabled={pending}
        className="flex h-11.5 flex-none cursor-pointer items-center px-5 type-button text-diploma inset-ring inset-ring-diploma/22 hover:text-burdell disabled:cursor-wait"
      >
        {pending ? "Signing out" : "Sign out"}
      </button>
    </div>
  );
}

export function Frame({
  children,
  footer,
  signOut,
}: {
  children: ReactNode;
  footer?: ReactNode;
  signOut?: boolean;
}) {
  return (
    <div className="relative flex min-h-dvh flex-col surface-ramp lg:h-dvh">
      <div className="grain z-10" />

      <Link
        to="/"
        aria-label="ColorStack at Georgia Tech, home"
        className="absolute top-6.5 left-page z-20 h-11.5"
      >
        <Mark mark="lockup" className="h-full" />
      </Link>

      {signOut ? <SignOut /> : null}

      <div className="mx-auto grid w-full max-w-420 flex-1 lg:h-full lg:grid-cols-[minmax(0,1fr)_34%]">
        <div className="flex flex-col items-center px-page pt-26 pb-10 lg:overflow-y-auto lg:pt-18">
          <div className="my-auto w-full max-w-column">{children}</div>
          {footer ? <div className="w-full max-w-column pt-6.5">{footer}</div> : null}
        </div>
        <div
          aria-hidden
          className="hidden bg-[url(/assets/art/pane-rail.svg)] bg-cover bg-center lg:block"
        />
      </div>

      <div
        aria-hidden
        className="h-22 flex-none bg-[url(/assets/art/pane-band.svg)] bg-cover bg-center lg:hidden"
      />
    </div>
  );
}
