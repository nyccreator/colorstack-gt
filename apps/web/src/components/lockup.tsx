import { Link } from "@tanstack/react-router";

export function Lockup() {
  return (
    <Link to="/" className="inline-flex items-center gap-3 text-wordmark">
      <img src="/assets/colorstack-gt-dark.svg" alt="" className="h-[2.1em] w-auto" />
      <span className="inline-flex items-baseline gap-[0.26em] type-display whitespace-nowrap text-neutral-ink-cream">
        <span>ColorStack</span>
        <span className="hidden text-gold italic sm:inline">at</span>
        <img
          src="/assets/gt-wordmark-gold.svg"
          alt="Georgia Tech"
          className="hidden h-[0.89em] w-auto translate-y-[21.6%] sm:block"
        />
      </span>
    </Link>
  );
}
