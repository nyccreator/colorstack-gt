import type { Group } from "@colorstack-gt/backend/convex/lib/groups";

export const TITLES: Record<Group, string> = {
  name: "Who you are",
  contact: "How we reach you",
  studies: "Your studies",
  materials: "Your career",
  interests: "Your interests",
  background: "Your background",
};

export type Editor = Exclude<Group, "materials"> | "resume" | "links";

export const GROUP_OF: Record<Editor, Group> = {
  name: "name",
  contact: "contact",
  studies: "studies",
  resume: "materials",
  links: "materials",
  interests: "interests",
  background: "background",
};
