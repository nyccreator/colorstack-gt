export type Art =
  | "company"
  | "event"
  | "hangout"
  | "mentor"
  | "mixer"
  | "panel"
  | "resume"
  | "study"
  | "workshop";
export type Tone = "navy" | "navy-medium" | "campanile" | "tech-lawn" | "whistle";

export type ClubEvent = {
  id: string;
  title: string;
  startsAt: number;
  endsAt: number;
  place: string;
  about: string;
  art: Art;
  tone: Tone;
  flier?: { src: string; width: number; height: number };
  link?: { label: "RSVP" | "Register"; href: string };
};

// There is no source of events yet, so the page shows its empty state.
export const EVENTS: readonly ClubEvent[] = [];
