import type { Doc } from "../_generated/dataModel";

export const GROUPS = [
  "name",
  "contact",
  "studies",
  "materials",
  "interests",
  "background",
] as const;
export type Group = (typeof GROUPS)[number];

export const OPTIONAL = ["materials", "interests"] as const satisfies readonly Group[];
type OptionalGroup = (typeof OPTIONAL)[number];

export const isOptional = (group: Group): group is OptionalGroup =>
  (OPTIONAL as readonly Group[]).includes(group);

/** `members.step` holds the highest group reached, so a skipped optional group still counts as done. */
export const stepOf = (group: Group): number => GROUPS.indexOf(group) + 1;

export function savedGroups(
  member: Doc<"members"> | null,
  reported: boolean,
): Record<Group, boolean> {
  const passed = (group: OptionalGroup) => (member?.step ?? 0) >= stepOf(group);
  return {
    name: Boolean(member?.name),
    contact: Boolean(member?.contact),
    studies: Boolean(member?.studies),
    materials: Boolean(member?.materials || member?.resume) || passed("materials"),
    interests: Boolean(member?.interests) || passed("interests"),
    background: reported,
  };
}

export const isComplete = (saved: Record<Group, boolean>): boolean =>
  GROUPS.every((group) => isOptional(group) || saved[group]);
