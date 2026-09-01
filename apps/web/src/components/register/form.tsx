import { api } from "@colorstack-gt/backend/convex/_generated/api";
import { env } from "@colorstack-gt/env/web";
import { Link, useNavigate } from "@tanstack/react-router";
import { useAction } from "convex/react";
import { ConvexError } from "convex/values";
import { type FormEvent, useEffect, useRef, useState } from "react";

import { Rail } from "./rail";
import { Review } from "./review";
import { emptyForm, type Errors, type FormState, toSubmission, validateStep } from "./state";
import { AboutYou, Background, Experience, WhatYouWant, YourStudies } from "./steps";

const HEADINGS = [
  {
    lead: "About ",
    accent: "you",
    intro: "Your Georgia Tech email is how you'll sign in and check into events.",
  },
  {
    lead: "Your ",
    accent: "studies",
    intro: "So we can group you with people in your year and share the right opportunities.",
  },
  {
    lead: "Your ",
    accent: "experience",
    intro: "What you are part of outside class, and how partners can find you.",
  },
  {
    lead: "What you want from ",
    accent: "ColorStack",
    intro: "Pick as many as apply. It tells the e-board what to program this semester.",
  },
  {
    lead: "A little about your ",
    accent: "background",
    intro: "Used for chapter reporting to ColorStack nationally, always in aggregate.",
  },
  {
    lead: "Before you ",
    accent: "join",
    intro: "Check everything over, then we'll email you a link to finish.",
  },
] as const;

const LAST = HEADINGS.length;

export function RegisterForm({ email }: { email?: string }) {
  const navigate = useNavigate();
  const start = useAction(api.members.start);
  const register = useAction(api.members.register);

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(() => emptyForm(email));
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);
  /** Kept so a failed submit does not upload the same file again. */
  const uploaded = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (moved.current) heading.current?.focus();
    moved.current = false;
  }, [step]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    if (key === "resume") uploaded.current = undefined;
    setForm((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: undefined }));
  }

  function goTo(next: number) {
    moved.current = true;
    setErrors({});
    setStep(next);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    const found = validateStep(step, form);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }

    if (step === 1) {
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

    if (step < LAST) {
      goTo(step + 1);
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

  const { lead, accent, intro } = HEADINGS[step - 1];

  return (
    <div className="relative min-h-dvh md:grid md:grid-cols-[auto_1fr]">
      <div className="wash-register" />
      <Rail current={step} />

      <form
        onSubmit={onSubmit}
        noValidate
        className="relative flex min-h-dvh flex-col bg-diploma px-6 py-10 text-neutral-ink-navy sm:px-10 md:px-14 md:py-12"
      >
        <div className="flex flex-1 flex-col">
          <h2 ref={heading} tabIndex={-1} className="type-display text-step outline-none">
            {lead}
            <span className="text-gold-dark italic">{accent}</span>
          </h2>
          <p className="mt-3 mb-8 max-w-[80ch] text-body leading-copy text-neutral-body-cream">
            {intro}
          </p>

          {step === 1 ? <AboutYou form={form} errors={errors} set={set} /> : null}
          {step === 2 ? <YourStudies form={form} errors={errors} set={set} /> : null}
          {step === 3 ? <Experience form={form} errors={errors} set={set} /> : null}
          {step === 4 ? <WhatYouWant form={form} errors={errors} set={set} /> : null}
          {step === 5 ? <Background form={form} errors={errors} set={set} /> : null}
          {step === LAST ? <Review form={form} onEdit={goTo} /> : null}
        </div>

        <p aria-live="polite" className="sr-only">
          Step {step} of {LAST}
        </p>

        {submitError ? (
          <p role="alert" className="mt-6 text-note text-error">
            {submitError}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-5 gap-y-4 pt-8">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => goTo(step - 1)}
              className="cursor-pointer rounded-pill border border-neutral-border-input px-7 py-4 text-small font-medium whitespace-nowrap text-neutral-body-cream hover:border-gold hover:text-neutral-ink-navy"
            >
              Back
            </button>
          ) : null}

          <button
            type="submit"
            disabled={submitting || checking}
            className={`cursor-pointer rounded-pill px-8 py-4 text-body font-semibold whitespace-nowrap hover:opacity-[0.88] disabled:cursor-wait disabled:opacity-60 ${
              step === LAST ? "bg-buzz text-navy" : "bg-navy text-diploma"
            }`}
          >
            {step === LAST ? (submitting ? "Sending…" : "Become a Member") : "Continue"}
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
