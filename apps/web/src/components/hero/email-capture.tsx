import { useNavigate } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";

export function EmailCapture() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate({ to: "/register", search: { email: email.trim() || undefined } });
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-capsule">
      <div className="flex flex-col gap-2 rounded-3xl border border-gold/45 bg-diploma/8 p-2 sm:flex-row sm:items-center sm:rounded-pill sm:pl-6">
        <input
          type="email"
          required
          autoComplete="email"
          aria-label="Your Georgia Tech email"
          placeholder="you@gatech.edu"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="min-w-0 flex-1 border-0 bg-transparent px-4 py-4 text-input-hero text-neutral-ink-cream shadow-none outline-none placeholder:text-neutral-muted-navy focus:border-0 focus:shadow-none sm:px-0"
        />
        <button
          type="submit"
          className="rounded-pill bg-buzz px-8 py-4 text-body font-semibold whitespace-nowrap text-navy hover:opacity-[0.88]"
        >
          Become a Member
        </button>
      </div>
    </form>
  );
}
