import { Link, useLocation, useNavigate, useRouter } from "@tanstack/react-router";
import { type MouseEvent, type ReactNode, useState } from "react";

import { useSlow } from "@/lib/motion";
import { signOut } from "@/lib/session";

import Loader from "./loader";
import { Mark } from "./mark";

export function Waiting({ under = true }: { under?: boolean }) {
  return <div className={under ? "pt-page" : ""}>{useSlow(true) ? <Loader /> : null}</div>;
}

export const mayLeave = (unsaved?: () => boolean) =>
  !unsaved?.() || window.confirm("You have unsaved changes. Leave without saving them?");

export function announce(from: Element | string, text: string) {
  let status: Element | null;
  if (typeof from === "string") status = document.getElementById(from);
  else {
    const reachable = from.closest("dialog[open]") ?? document;
    status = reachable.querySelector("[role=status]");
  }
  if (!status) return;
  status.textContent = "";
  setTimeout(() => (status.textContent = text), 50);
}

function SignOut({ unsaved }: { unsaved?: () => boolean }) {
  const router = useRouter();
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const slow = useSlow(pending);

  async function leave() {
    if (!mayLeave(unsaved)) return;
    setPending(true);
    if (!(await signOut(router))) return setPending(false);
    await navigate({ to: "/", ignoreBlocker: true });
  }

  return (
    <button
      type="button"
      onClick={leave}
      disabled={pending}
      className="pointer-events-auto -my-2 -mr-link-x flex h-12 flex-none cursor-pointer items-center rounded-full px-link-x type-nav text-diploma/70 transition-[background-color,color] hover:bg-diploma/13 hover:text-diploma focus-visible:text-diploma active:bg-diploma/13 disabled:cursor-wait"
    >
      {slow ? "Signing out…" : "Sign out"}
    </button>
  );
}

export function Pages({ dock }: { dock?: boolean }) {
  const path = useLocation({ select: (location) => location.pathname });
  const inertIfCurrent = (to: string) =>
    to === path ? (e: MouseEvent) => e.preventDefault() : undefined;
  return (
    <nav aria-label="Pages" className={dock ? "pages pages-dock" : "pages"}>
      <Link to="/hub" onClick={inertIfCurrent("/hub")}>
        Events
      </Link>
      <Link to="/you" onClick={inertIfCurrent("/you")}>
        You
      </Link>
    </nav>
  );
}

export function Bar({
  signOut,
  unsaved,
  nav,
  className = "",
}: {
  signOut?: boolean;
  unsaved?: () => boolean;
  nav?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={`pointer-events-none absolute inset-x-0 top-0 z-40 flex items-center justify-between gap-3 px-edge pt-bar-top pb-bar-bottom ${className}`}
    >
      <Link
        to="/"
        aria-label="ColorStack at Georgia Tech, home"
        className="pointer-events-auto relative block h-lock rounded-xl after:absolute after:-inset-1"
      >
        <Mark mark="lockup" className="h-full w-auto" />
      </Link>
      {nav ? (
        <div className="pointer-events-auto absolute top-[calc(var(--spacing-bar-top)+var(--spacing-lock)/2)] left-1/2 -translate-1/2">
          {nav}
        </div>
      ) : null}
      {signOut ? <SignOut unsaved={unsaved} /> : null}
    </header>
  );
}
