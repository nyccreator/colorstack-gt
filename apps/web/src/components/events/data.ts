type Art =
  | "company"
  | "event"
  | "hangout"
  | "mentor"
  | "mixer"
  | "panel"
  | "resume"
  | "study"
  | "workshop";
type Tone = "navy" | "navy-medium" | "campanile" | "tech-lawn" | "whistle";

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

export const EVENTS: readonly ClubEvent[] = [];
