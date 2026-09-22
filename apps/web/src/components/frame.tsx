import { api } from "@colorstack-gt/backend/convex/_generated/api";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { type ReactNode, useState } from "react";

import { authClient } from "@/lib/auth-client";

import { Mark } from "./mark";

type Anchor = "high" | "mid" | "low";

const ANCHOR: Record<Anchor, string> = {
  high: "justify-start pt-anchor",
  mid: "justify-start pt-anchor shell:justify-center shell:pt-[calc(var(--spacing-bar)+clamp(16px,3vh,40px))] shell:pb-[calc(var(--spacing-bar)+clamp(16px,3vh,40px))]",
  low: "justify-start pt-[calc(var(--spacing-bar)+clamp(28px,7vh,64px))] shell:pt-anchor-low",
};

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
    <span className="pointer-events-auto flex min-w-0 items-center gap-3 sm:gap-4.5">
      {me ? (
        <span className="hidden min-w-0 truncate text-button text-diploma/86 sm:block">
          {me.gtEmail}
        </span>
      ) : null}
      <button
        type="button"
        onClick={signOut}
        disabled={pending}
        className="flex h-12 flex-none cursor-pointer items-center rounded-full border border-diploma/55 px-5.5 type-button text-diploma hover:border-burdell hover:text-burdell disabled:cursor-wait"
      >
        {pending ? "Signing out" : "Sign out"}
      </button>
    </span>
  );
}

export function Bar({ signOut }: { signOut?: boolean }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-40 flex items-center justify-between gap-3 px-edge py-bar-pad">
      <Link
        to="/"
        aria-label="ColorStack at Georgia Tech, home"
        className="pointer-events-auto block h-lock"
      >
        <Mark mark="lockup" className="h-full w-auto" />
      </Link>
      {signOut ? <SignOut /> : null}
    </div>
  );
}

export function Frame({
  children,
  anchor = "mid",
  art,
  rail,
  footer,
  signOut,
  wide,
}: {
  children: ReactNode;
  anchor?: Anchor;
  art?: ReactNode;
  rail?: ReactNode;
  footer?: ReactNode;
  signOut?: boolean;
  wide?: boolean;
}) {
  const columns = rail
    ? "shell:grid-cols-[minmax(0,1fr)_var(--container-rail)]"
    : art
      ? "shell:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]"
      : "";
  const gutterRight = rail || art ? "pr-inset shell:pr-inset" : "pr-edge";

  return (
    <div className={`grid min-h-dvh grid-rows-[minmax(0,1fr)_auto] bg-blue-bright ${columns}`}>
      <Bar signOut={signOut} />

      <div
        className={`flex min-h-0 flex-col overflow-y-auto pl-edge pb-[clamp(20px,4vh,44px)] ${gutterRight} ${ANCHOR[anchor]}`}
      >
        <div
          className={`flex min-h-0 w-full flex-col ${wide ? "" : "max-w-column"} ${anchor === "mid" ? "shell:flex-none" : "flex-1"}`}
        >
          {children}
        </div>
      </div>

      {rail ? (
        <div className="hidden bg-navy shell:col-start-2 shell:row-span-2 shell:flex shell:flex-col shell:px-[clamp(20px,2.4vw,40px)] shell:pt-anchor shell:pb-[clamp(24px,4vh,44px)]">
          {rail}
        </div>
      ) : null}

      {art ? (
        <div className="flex items-center justify-center bg-navy p-[clamp(18px,4vh,48px)] shell:col-start-2 shell:row-span-2">
          {art}
        </div>
      ) : null}

      {footer ?? null}
    </div>
  );
}
