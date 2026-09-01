import { api } from "@colorstack-gt/backend/convex/_generated/api";
import { isGeorgiaTechEmail } from "@colorstack-gt/backend/convex/lib/identity";
import { useNavigate } from "@tanstack/react-router";
import { useAction } from "convex/react";
import { ConvexError } from "convex/values";
import { type FormEvent, useState } from "react";

export function EmailCapture() {
  const navigate = useNavigate();
  const start = useAction(api.members.start);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = email.trim();

    if (!value) {
      setError("Enter your Georgia Tech email.");
      return;
    }
    if (!isGeorgiaTechEmail(value)) {
      setError("Use your gatech.edu address to join.");
      return;
    }

    setPending(true);
    try {
      const next = await start({ gtEmail: value });
      await (next === "link_sent"
        ? navigate({ to: "/register/done", search: { status: "exists", email: value } })
        : navigate({ to: "/register", search: { email: value } }));
    } catch (failure) {
      setError(
        failure instanceof ConvexError ? String(failure.data) : "Something went wrong. Try again.",
      );
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="w-full max-w-capsule">
      <div
        className={`flex flex-col gap-2 rounded-3xl border bg-diploma/8 p-2 sm:flex-row sm:items-center sm:rounded-pill sm:pl-6 ${
          error ? "border-error" : "border-gold/45"
        }`}
      >
        <input
          type="email"
          autoComplete="email"
          aria-label="Your Georgia Tech email"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "hero-email-error" : undefined}
          placeholder="you@gatech.edu"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setError(null);
          }}
          className="min-w-0 flex-1 border-0 bg-transparent px-4 py-4 text-input-hero text-neutral-ink-cream shadow-none outline-none placeholder:text-neutral-muted-navy focus:border-0 focus:shadow-none sm:px-0"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-pill bg-buzz px-8 py-4 text-body font-semibold whitespace-nowrap text-navy hover:opacity-[0.88] disabled:cursor-wait disabled:opacity-70"
        >
          {pending ? "One moment…" : "Become a Member"}
        </button>
      </div>
      {error ? (
        <p
          id="hero-email-error"
          role="alert"
          className="mt-3 px-2 text-note text-neutral-ink-cream sm:px-6"
        >
          {error}
        </p>
      ) : null}
    </form>
  );
}
