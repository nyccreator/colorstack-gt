import type { Group } from "@colorstack-gt/backend/convex/lib/groups";
import { createElement, type ReactNode } from "react";

import type { Profile } from "@/lib/member";

import { CLASS_STANDINGS, HOBBIES, labelOf, labelsOf, LOOKING_FOR } from "../onboarding/options";

export const few = (labels: readonly string[]) =>
  labels.length > 3
    ? `${labels.slice(0, 2).join(", ")} + ${labels.length - 2} more`
    : labels.join(", ");

const listed = (parts: string[]) =>
  parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}` : (parts[0] ?? "");

export function summary(me: Profile, group: Group) {
  switch (group) {
    case "name":
      return [
        me.name && `${me.name.firstName} ${me.name.lastName}`,
        me.name?.pronouns?.replace(/ \/ /g, " / "),
      ]
        .filter(Boolean)
        .join(" · ");
    case "contact":
      return me.contact
        ? `${me.contact.personalEmail} · ${me.contact.phone.replace(/-/g, "‑")}`
        : "";
    case "studies":
      return me.studies
        ? `${labelOf(CLASS_STANDINGS, me.studies.classStanding)} · ${me.studies.major}`
        : "";
    case "materials": {
      const parts = [
        me.resume ? "Resume" : "",
        me.materials?.linkedin ? "LinkedIn" : "",
        me.materials?.github ? "GitHub" : "",
      ].filter(Boolean);
      return listed(parts) || "Skipped";
    }
    case "background":
      return "Saved privately";
    case "interests": {
      const all = [
        ...labelsOf(LOOKING_FOR, me.interests?.lookingFor),
        ...labelsOf(HOBBIES, me.interests?.hobbies),
      ];
      return few(all) || "Skipped";
    }
  }
}

// A short last part such as "com" stays joined to the one before it.
export function breaks(text: string): ReactNode[] {
  const parts = text.split(/(?<=[@./])/);
  if (parts.length > 1 && parts.at(-1)!.length < 6) parts.splice(-2, 2, parts.slice(-2).join(""));
  return parts.flatMap((part, i) => (i ? [createElement("wbr", { key: i }), part] : [part]));
}
