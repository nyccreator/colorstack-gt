import { api } from "@colorstack-gt/backend/convex/_generated/api";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useConvexAuth, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useEffect, useRef } from "react";

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

// `me === null` is a question, not an answer: Convex may have dropped its auth while the session cookie is fine.
export function useMember(need?: Need): Member {
  const me = useQuery(api.members.me);
  const answers = useQuery(api.members.myDemographics);
  const auth = useConvexAuth();
  const navigate = useNavigate();
  const router = useRouter();
  const latest = useRef(me);
  const tries = useRef(0);
  // oxlint-disable-next-line react/refs -- The async check must read the newest answer when it lands.
  latest.current = me;

  const gone = me === null && !auth.isLoading;
  useEffect(() => {
    if (me !== null) tries.current = 0;
    if (!gone) return;
    let live = true;
    void authClient.getSession().then(({ data, error }) => {
      if (!live || error || latest.current !== null) return;
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
    return () => {
      live = false;
    };
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- The check restarts only when Convex's auth changes, not on every answer or navigation.
  }, [gone, auth.isAuthenticated]);

  const short = me
    ? need === "complete" && !me.complete
      ? { to: "/onboarding", search: { gated: true } }
      : need === "roster" && !me.onRoster
        ? { to: "/hub" }
        : null
    : null;
  useEffect(() => {
    if (short) void navigate({ ...short, replace: true });
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- Redirects only when the destination changes.
  }, [short?.to]);

  if (me === undefined || answers === undefined || me === null) return { status: "loading" };
  if (short) return { status: "away" };
  return { status: "ready", me, answers };
}
