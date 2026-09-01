import { api } from "@colorstack-gt/backend/convex/_generated/api";
import { env } from "@colorstack-gt/env/web";
import { Link, useNavigate } from "@tanstack/react-router";
import { useAction } from "convex/react";
import { ConvexError } from "convex/values";
import { type FormEvent, useEffect, useRef, useState } from "react";

import { Joining, You, YourInterests } from "./chapters";
import { Rail } from "./rail";
import {
  emptyForm,
  type Errors,
  firstErrorSection,
  type FormState,
  sectionProgress,
  toSubmission,
  validateChapter,
} from "./state";

const HEADINGS = [
  { lead: "About ", accent: "you", next: "Continue to Your interests" },
  { lead: "Your ", accent: "interests", next: "Continue to Joining" },
  { lead: "Before you ", accent: "join", next: "Become a Member" },
] as const;

const LAST = HEADINGS.length;

export function RegisterForm({ email }: { email?: string }) {
  const navigate = useNavigate();
  const start = useAction(api.members.start);
  const register = useAction(api.members.register);

  const [chapter, setChapter] = useState(1);
  const [form, setForm] = useState<FormState>(() => emptyForm(email));
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);
  /** The section to land on once the new chapter has rendered. */
  const anchor = useRef<string | null>(null);
  /** Kept so a failed submit does not upload the same file again. */
  const uploaded = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;

    const target = anchor.current;
    anchor.current = null;

    if (target) {
      focusSection(target);
      return;
    }
    heading.current?.focus();
    window.scrollTo({ top: 0 });
  }, [chapter]);

  function focusSection(id: string) {
    const element = document.getElementById(id);
    if (!element) return;
    element.focus({ preventScroll: true });
    element.scrollIntoView({ block: "start" });
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    if (key === "resume") uploaded.current = undefined;
    setForm((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: undefined }));
  }

  /** Puts someone on the chapter that failed, with its errors showing. */
  function reject(target: number, found: Errors) {
    const section = firstErrorSection(found);
    setErrors(found);

    if (target === chapter) {
      if (section) focusSection(section);
      return;
    }
    moved.current = true;
    anchor.current = section ?? null;
    setChapter(target);
  }

  function goTo(next: number, section?: string) {
    if (next === chapter) {
      if (section) focusSection(section);
      return;
    }

    // Going forward from the rail has to clear every chapter it skips over.
    for (let step = chapter; step < next; step++) {
      const found = validateChapter(step, form);
      if (Object.keys(found).length > 0) {
        reject(step, found);
        return;
      }
    }

    moved.current = true;
    anchor.current = section ?? null;
    setErrors({});
    setChapter(next);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    const found = validateChapter(chapter, form);
    if (Object.keys(found).length > 0) {
      reject(chapter, found);
      return;
    }

    if (chapter === 1) {
      setChecking(true);
      try {
        if ((await start({ gtEmail: form.gtEmail })) === "link_sent") {
          await navigate({
            to: "/register/done",
            search: { status: "exists", email: form.gtEmail.trim() },
          });
          return;
        }
      } catch (error) {
        setSubmitError(
          error instanceof ConvexError ? String(error.data) : "Something went wrong. Try again.",
        );
        return;
      } finally {
        setChecking(false);
      }
    }

    if (chapter < LAST) {
      goTo(chapter + 1);
      return;
    }

    setSubmitting(true);
    try {
      let resumeUploadToken = uploaded.current;
      if (form.resume && !resumeUploadToken) {
        const response = await fetch(`${env.VITE_CONVEX_SITE_URL}/resume`, {
          method: "POST",
          headers: { "Content-Type": form.resume.type },
          body: form.resume,
        });
        if (!response.ok) {
          setSubmitError((await response.text()) || "The resume upload failed. Try again.");
          setSubmitting(false);
          return;
        }
        resumeUploadToken = (await response.json()).token;
        uploaded.current = resumeUploadToken;
      }

      const status = await register(toSubmission(form, resumeUploadToken));
      await navigate({
        to: "/register/done",
        search: { status, email: form.gtEmail.trim() },
      });
    } catch (error) {
      setSubmitError(
        error instanceof ConvexError ? String(error.data) : "Something went wrong. Try again.",
      );
      setSubmitting(false);
    }
  }

  const { lead, accent, next } = HEADINGS[chapter - 1];
  const progress = sectionProgress(form, errors);

  return (
    <div className="relative min-h-dvh md:grid md:grid-cols-[auto_1fr] md:items-start">
      <div className="wash-register" />
      <Rail current={chapter} progress={progress} onGo={goTo} />

      <form
        onSubmit={onSubmit}
        noValidate
        className="relative flex min-h-dvh flex-col bg-diploma text-neutral-ink-navy"
      >
        <div className="flex-1 px-6 pt-10 pb-12 sm:px-10 md:px-14 md:pt-11">
          <h2 ref={heading} tabIndex={-1} className="type-display text-step outline-none">
            {lead}
            <span className="text-gold-dark italic">{accent}</span>
          </h2>
          {chapter === 1 ? <You form={form} errors={errors} set={set} /> : null}
          {chapter === 2 ? <YourInterests form={form} errors={errors} set={set} /> : null}
          {chapter === 3 ? <Joining form={form} errors={errors} set={set} onEdit={goTo} /> : null}

          <p aria-live="polite" className="sr-only">
            Chapter {chapter} of {LAST}
          </p>

          {submitError ? (
            <p role="alert" className="mt-6 text-note text-error">
              {submitError}
            </p>
          ) : null}
        </div>

        <div className="sticky bottom-0 flex flex-wrap items-center gap-x-5 gap-y-4 border-t border-neutral-rule-cream bg-neutral-cream-raised px-6 py-4 sm:px-10 md:px-14">
          {chapter > 1 ? (
            <button
              type="button"
              onClick={() => goTo(chapter - 1)}
              className="cursor-pointer rounded-pill border border-neutral-border-input px-7 py-4 text-small font-medium whitespace-nowrap text-neutral-body-cream hover:border-gold hover:text-neutral-ink-navy"
            >
              Back
            </button>
          ) : null}

          <button
            type="submit"
            disabled={submitting || checking}
            className={`cursor-pointer rounded-pill px-8 py-4 text-body font-semibold whitespace-nowrap hover:opacity-[0.88] disabled:cursor-wait disabled:opacity-60 ${
              chapter === LAST ? "bg-buzz text-navy" : "bg-navy text-diploma"
            }`}
          >
            {chapter === LAST && submitting ? "Sending…" : next}
          </button>

          <Link
            to="/login"
            className="ml-auto type-label whitespace-nowrap text-neutral-label-cream"
          >
            Already a member? Log in &#8594;
          </Link>
        </div>
      </form>
    </div>
  );
}
