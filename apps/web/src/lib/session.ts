import { api } from "@colorstack-gt/backend/convex/_generated/api";
import { type AnyRouter, type ParsedLocation, redirect } from "@tanstack/react-router";
import type { ConvexReactClient } from "convex/react";
import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { authClient } from "./auth-client";

let cached: Promise<string | undefined> | null = null;
let seeded = false;
let seed: string | null = null;

export function sessionToken(load: () => Promise<string | undefined>) {
  if (typeof window === "undefined") return load();
  cached ??= load().catch((failure: unknown) => {
    cached = null;
    throw failure;
  });
  return cached;
}

export function seedSessionOnce(token: string | undefined) {
  if (typeof window === "undefined" || seeded) return;
  seeded = true;
  cached ??= Promise.resolve(token);
  seed = token ?? null;
}

export function forgetSession() {
  cached = null;
}

type Guarded = { context: { token: string | undefined }; location: ParsedLocation };

export const requireSession = ({ context, location }: Guarded) => {
  if (!context.token) throw redirect({ to: "/sign-in", search: { redirect: location.href } });
};

export const guestOnly = ({ context, search }: Guarded & { search: { redirect?: string } }) => {
  if (context.token) throw redirect({ href: landing(search.redirect) });
};

// Browsers read "/\host" and "/\t/host" as "//host", so only a path that resolves to this origin is kept.
export function landing(redirect: string | undefined) {
  if (!redirect?.startsWith("/")) return "/onboarding";
  const url = new URL(redirect, "https://site.invalid");
  return url.origin === "https://site.invalid"
    ? url.pathname + url.search + url.hash
    : "/onboarding";
}

export type Auth = {
  isLoading: boolean;
  isAuthenticated: boolean;
  fetchAccessToken: (args: { forceRefreshToken: boolean }) => Promise<string | null>;
};

const retry = { count: 0, listeners: new Set<() => void>() };
const onRetry = (listener: () => void) => {
  retry.listeners.add(listener);
  return () => void retry.listeners.delete(listener);
};

// A new fetchAccessToken makes ConvexProviderWithAuth run setAuth again, which is how a lost websocket auth is repaired.
export function retryAuth() {
  retry.count++;
  retry.listeners.forEach((listener) => listener());
}

export function useAuth(): Auth {
  const { data: session, isPending } = authClient.useSession();
  const attempt = useSyncExternalStore(
    onRetry,
    () => retry.count,
    () => 0,
  );
  const [token, setToken] = useState(() => {
    const first = seed;
    seed = null;
    return first;
  });
  const inFlight = useRef<Promise<string | null> | null>(null);
  const sessionId = session?.session.id;
  if (!session && !isPending && token) setToken(null);

  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      if (token && !forceRefreshToken) return token;
      if (inFlight.current && !forceRefreshToken) return inFlight.current;
      const fetching = authClient.convex
        .token({ fetchOptions: { throw: false } })
        .then(
          ({ data }) => data?.token || null,
          () => null,
        )
        .then((fresh) => {
          setToken(fresh);
          return fresh;
        })
        .finally(() => {
          if (inFlight.current === fetching) inFlight.current = null;
        });
      inFlight.current = fetching;
      return fetching;
    },
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- The identity changes only with the session or a retry, since each change restarts Convex's auth.
    [sessionId, attempt],
  );

  return useMemo(
    () => ({
      isLoading: isPending && !token,
      isAuthenticated: Boolean(session?.session) || token !== null,
      fetchAccessToken,
    }),
    [isPending, session, token, fetchAccessToken],
  );
}

const MEMBER_WAIT = 4000;
const MEMBER_WATCH = 10_000;

function preloadMember(convex: ConvexReactClient) {
  const watches = [
    convex.watchQuery(api.members.me),
    convex.watchQuery(api.members.myDemographics),
  ];
  const ready = () => {
    try {
      return (
        Boolean(watches[0]!.localQueryResult()) && watches[1]!.localQueryResult() !== undefined
      );
    } catch {
      return true;
    }
  };
  return new Promise<void>((resolve) => {
    const stops = watches.map((watch) => watch.onUpdate(() => ready() && resolve()));
    if (ready()) resolve();
    setTimeout(resolve, MEMBER_WAIT);
    setTimeout(() => stops.forEach((stop) => stop()), MEMBER_WATCH);
  });
}

export async function signIn(
  router: AnyRouter,
  convex: ConvexReactClient,
  credentials: { email: string; otp: string },
) {
  const result = await authClient.signIn.emailOtp(credentials).catch(() => null);
  if (result && !result.error) {
    forgetSession();
    await router.invalidate();
    await preloadMember(convex);
  }
  return result;
}

export async function signOut(router: AnyRouter) {
  const { error } = await authClient.signOut().catch(() => ({ error: true }));
  if (error) return false;
  forgetSession();
  await router.invalidate();
  return true;
}
