import type { api } from "@colorstack-gt/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";

export type ClubEvent = FunctionReturnType<typeof api.events.list>[number];

export const isPast = (e: Pick<ClubEvent, "endsAt">, now: number) => e.endsAt <= now;
