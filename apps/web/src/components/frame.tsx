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

// A modal dialog makes the page's region inert, so a speaker inside one uses the dialog's own.
export function announce(from: Element | string, text: string) {
  const status =
    typeof from === "string"
      ? document.getElementById(from)
      : (from.closest("dialog[open]") ?? document).querySelector("[role=status]");
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
  // A link to the page you're on does nothing, since following it would close what's open there.
  const stay = (to: string) => (to === path ? (e: MouseEvent) => e.preventDefault() : undefined);
  return (
    <nav aria-label="Pages" className={dock ? "pages pages-dock" : "pages"}>
      <Link to="/hub" onClick={stay("/hub")}>
        Events
      </Link>
      <Link to="/you" onClick={stay("/you")}>
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
