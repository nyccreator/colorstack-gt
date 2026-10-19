import { api } from "@colorstack-gt/backend/convex/_generated/api";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useConvexAuth, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useEffect, useEffectEvent, useRef } from "react";

import { authClient } from "./auth-client";
import { forgetSession, retryAuth } from "./session";

export type Profile = NonNullable<FunctionReturnType<typeof api.members.me>>;
export type Answers = NonNullable<FunctionReturnType<typeof api.members.myDemographics>>;

type Need = "complete" | "roster";

export type Member =
  | { status: "loading" }
  | { status: "away" }
  | { status: "ready"; me: Profile; answers: Answers | null };

const RETRIES = 2;

type Session = Awaited<ReturnType<typeof authClient.getSession>>;

export function useMember(need?: Need): Member {
  const me = useQuery(api.members.me);
  const answers = useQuery(api.members.myDemographics);
  const auth = useConvexAuth();
  const navigate = useNavigate();
  const router = useRouter();
  const tries = useRef(0);

  const resetTries = useEffectEvent(() => {
    if (me !== null) tries.current = 0;
  });
  const onSession = useEffectEvent(({ data, error }: Session) => {
    if (error || me !== null) return;
    if (data?.session) {
      if (tries.current < RETRIES) {
        tries.current++;
        retryAuth();
      }
      return;
    }
    forgetSession();
    void navigate({
      to: "/sign-in",
      search: { redirect: router.state.location.href },
      replace: true,
    });
  });

  const convexSaysSignedOut = me === null && !auth.isLoading;
  useEffect(() => {
    resetTries();
    if (!convexSaysSignedOut) return;
    let live = true;
    void authClient.getSession().then((session) => {
      if (live) onSession(session);
    });
    return () => {
      live = false;
    };
  }, [convexSaysSignedOut, auth.isAuthenticated]);

  const short: "/onboarding" | "/hub" | null = me
    ? need === "complete" && !me.complete
      ? "/onboarding"
      : need === "roster" && !me.onRoster
        ? "/hub"
        : null
    : null;
  useEffect(() => {
    if (short === "/onboarding")
      void navigate({ to: short, search: { gated: true }, replace: true });
    if (short === "/hub") void navigate({ to: short, replace: true });
  }, [short, navigate]);

  if (me === undefined || answers === undefined || me === null) return { status: "loading" };
  if (short) return { status: "away" };
  return { status: "ready", me, answers };
}
