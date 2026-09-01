import { Lockup } from "@/components/lockup";

import { STEPS } from "./options";

function pad(step: number) {
  return String(step).padStart(2, "0");
}

export function Rail({ current }: { current: number }) {
  return (
    <div className="relative flex flex-col border-gold/22 px-6 py-5 md:w-rail md:border-r md:px-9 md:py-6">
      <div className="mb-10 md:mb-14">
        <Lockup />
      </div>

      <h1 className="type-display text-page">
        Become a <span className="text-gold italic">member</span>
      </h1>

      <ol className="mt-7 hidden flex-col border-t border-gold/20 md:flex">
        {STEPS.map((label, index) => {
          const step = index + 1;
          const active = step === current;
          return (
            <li
              key={label}
              aria-current={active ? "step" : undefined}
              className={`flex items-center gap-4 py-4 ${
                index < STEPS.length - 1 ? "border-b border-gold/14" : ""
              } ${active ? "bg-linear-to-r from-gold/12 to-transparent" : ""}`}
            >
              <span
                className={`w-6 type-label ${active ? "text-gold" : "text-neutral-inactive-navy"}`}
              >
                {pad(step)}
              </span>
              <span
                className={`text-item ${
                  active ? "font-semibold text-neutral-ink-cream" : "text-neutral-muted-navy"
                }`}
              >
                {label}
              </span>
              {step < current ? <span className="ml-auto type-label text-gold">Done</span> : null}
            </li>
          );
        })}
      </ol>

      <div className="mt-8 flex flex-col gap-3 md:mt-auto">
        <div className="h-0.75 overflow-hidden rounded-full bg-diploma/14">
          <span
            className="block h-full bg-buzz transition-[width] duration-300"
            style={{ width: `${(current / STEPS.length) * 100}%` }}
          />
        </div>
        <span className="type-label text-neutral-muted-navy">
          Step {pad(current)} of {pad(STEPS.length)} &#183; {STEPS[current - 1]}
        </span>
      </div>
    </div>
  );
}
