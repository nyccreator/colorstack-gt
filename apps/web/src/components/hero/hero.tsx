import { Link } from "@tanstack/react-router";

import { Lockup } from "@/components/lockup";

import { EmailCapture } from "./email-capture";
import { SupporterBand } from "./supporter-band";

export function Hero() {
  return (
    <header>
      <div className="relative flex min-h-dvh flex-col overflow-hidden bg-navy text-neutral-ink-cream md:h-dvh md:min-h-180">
        <div className="wash-hero" />
        <div className="grain" />

        <nav className="relative flex flex-wrap items-center justify-between gap-4 px-6 py-5 md:px-9 md:py-6">
          <Lockup />
          <Link to="/login" className="type-label text-gold">
            Member log in &#8594;
          </Link>
        </nav>

        <div className="relative flex flex-1 flex-col items-center justify-center px-5 py-8 text-center md:px-14">
          <h1 className="m-0 flex flex-col items-center gap-[0.13em] type-display text-hero">
            <span>ColorStack</span>
            <span className="flex items-baseline gap-[0.26em]">
              <span className="text-gold italic">at</span>
              <img
                src="/assets/gt-wordmark-gold.svg"
                alt="Georgia Tech"
                className="block h-[0.89em] w-auto translate-y-[21.6%]"
              />
            </span>
          </h1>

          <div className="mt-10 mb-6 h-px w-16 bg-gold md:mt-14" />

          <p className="mb-10 max-w-[56ch] text-subhead leading-copy font-book text-neutral-body-navy md:mb-12 md:text-balance">
            Increasing the number of Black and Latinx Computer Science graduates who go on to start
            rewarding technical careers.
          </p>

          <EmailCapture />
        </div>

        <SupporterBand />
      </div>
    </header>
  );
}
