import { Lockup } from "@/components/lockup";

import { CHAPTERS } from "./options";
import { isComplete, type SectionProgress } from "./state";

function sum(sections: SectionProgress[], pick: (section: SectionProgress) => number) {
  return sections.reduce((total, section) => total + pick(section), 0);
}

function count(done: number, total: number, optional: number) {
  if (total > 0) return `${done} / ${total}`;
  return optional > 0 ? "Optional" : "";
}

type State = { error: boolean; active?: boolean; complete: boolean; started: boolean };

/** Errors outrank every other state, so a problem is never hidden by progress. */
function marker({ error, active, complete, started }: State) {
  if (error) return "text-error";
  if (active) return "text-buzz";
  if (complete) return "text-campanile";
  return started ? "text-gold" : "text-neutral-inactive-navy";
}

function dot({ error, complete, started }: State) {
  if (error) return "bg-error";
  if (complete) return "bg-campanile";
  return started ? "bg-gold" : "ring-1 ring-neutral-inactive-navy ring-inset";
}

export function Rail({
  current,
  progress,
  onGo,
}: {
  current: number;
  progress: SectionProgress[];
  onGo: (chapter: number, anchor?: string) => void;
}) {
  const answered = sum(progress, (section) => section.done);
  const askable = sum(progress, (section) => section.total);

  return (
    <div className="relative flex flex-col border-gold/22 px-6 py-5 md:h-dvh md:w-64 md:border-r md:px-6 md:py-6 lg:w-rail lg:px-8">
      <div className="mb-8 md:mb-11">
        <Lockup compact />
      </div>

      <h1 className="type-display text-page">
        Become a <span className="text-gold italic">member</span>
      </h1>

      <nav
        aria-label="Registration sections"
        className="mt-7 hidden min-h-0 flex-1 flex-col overflow-y-auto border-t border-gold/20 md:flex"
      >
        {CHAPTERS.map((chapter, index) => {
          const number = index + 1;
          const active = number === current;
          const sections = progress.filter((section) => section.chapter === number);
          const done = sum(sections, (section) => section.done);
          const total = sum(sections, (section) => section.total);
          const optional = sum(sections, (section) => section.optional);
          const state = {
            error: sections.some((section) => section.error),
            active,
            complete: isComplete(done, total, optional),
            started: done > 0,
          };

          return (
            <div
              key={chapter.num}
              className={`border-b border-gold/14 ${
                active ? "bg-linear-to-r from-gold/12 to-transparent" : ""
              }`}
            >
              <button
                type="button"
                aria-current={active ? "step" : undefined}
                onClick={() => onGo(number)}
                className="flex w-full cursor-pointer items-center gap-4 py-4 text-left"
              >
                <span className={`w-6 type-label ${marker(state)}`}>{chapter.num}</span>
                <span
                  className={`text-item ${
                    active ? "font-semibold text-neutral-ink-cream" : "text-neutral-body-navy"
                  }`}
                >
                  {chapter.title}
                </span>
                <span
                  className={`ml-auto type-label ${
                    state.error ? "text-error" : active ? "text-gold" : "text-neutral-inactive-navy"
                  }`}
                >
                  {count(done, total, optional)}
                </span>
              </button>

              {active ? (
                <div className="flex flex-col pb-3">
                  {sections.map((section) => (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => onGo(number, section.id)}
                      className="flex cursor-pointer items-center gap-3 py-2 pl-10 text-left"
                    >
                      <span
                        className={`size-1.75 shrink-0 rounded-full ${dot({
                          error: section.error,
                          complete: section.complete,
                          started: section.done > 0,
                        })}`}
                      />
                      <span
                        className={`text-detail ${
                          section.error ? "text-error" : "text-neutral-body-navy"
                        }`}
                      >
                        {section.label}
                      </span>
                      <span
                        className={`ml-auto type-label ${
                          section.error ? "text-error" : "text-neutral-muted-navy"
                        }`}
                      >
                        {count(section.done, section.total, section.optional)}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>

      <div className="mt-8 flex flex-col gap-3 md:mt-auto md:pt-6">
        <div className="h-0.75 overflow-hidden rounded-full bg-diploma/14">
          <span
            className="block h-full bg-buzz transition-[width] duration-300"
            style={{ width: `${(answered / askable) * 100}%` }}
          />
        </div>
        <span className="type-label text-neutral-muted-navy">
          <span className="md:hidden">
            Chapter {current} of {CHAPTERS.length} &#183;{" "}
          </span>
          {answered} of {askable} answered
        </span>
      </div>
    </div>
  );
}
