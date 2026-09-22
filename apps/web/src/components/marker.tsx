export function Marker({ state, onInk }: { state: "done" | "now" | "todo"; onInk?: boolean }) {
  const ring = onInk ? "border-navy/32" : "border-diploma/32";
  const now = onInk ? "border-navy" : "border-burdell";
  const dot = onInk ? "bg-navy" : "bg-burdell";
  const done = onInk ? "border-navy bg-navy text-diploma" : "border-diploma bg-diploma text-navy";

  return (
    <span
      aria-hidden
      className={`flex size-5.5 flex-none items-center justify-center rounded-full border-[1.5px] ${
        state === "done" ? done : state === "now" ? now : ring
      }`}
    >
      {state === "done" ? (
        <svg viewBox="0 0 20 20" className="size-5" fill="none" aria-hidden>
          <path
            d="M5.5 10.5l3.2 3.2L14.5 7"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : state === "now" ? (
        <span className={`size-2 rounded-full ${dot}`} />
      ) : null}
    </span>
  );
}
