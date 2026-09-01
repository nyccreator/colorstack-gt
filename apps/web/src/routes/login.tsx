import { api } from "@colorstack-gt/backend/convex/_generated/api";
import { isGeorgiaTechEmail } from "@colorstack-gt/backend/convex/lib/identity";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useAction } from "convex/react";
import { ConvexError } from "convex/values";
import { type FormEvent, useEffect, useRef, useState } from "react";

import { Lockup } from "@/components/lockup";
import { Shell } from "@/components/shell";

export const Route = createFileRoute("/login")({
  beforeLoad: ({ context }) => {
    if (context.isAuthenticated) throw redirect({ to: "/portal" });
  },
  component: Login,
});

function Login() {
  const start = useAction(api.members.start);

  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (sentTo) heading.current?.focus();
  }, [sentTo]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = email.trim();

    if (!value) {
      setError("Enter your Georgia Tech email.");
      return;
    }
    if (!isGeorgiaTechEmail(value)) {
      setError("Enter a gatech.edu address.");
      return;
    }

    setPending(true);
    try {
      if ((await start({ gtEmail: value })) === "register") {
        setError("We could not find an account for that address.");
        return;
      }
      setSentTo(value);
    } catch (failure) {
      setError(
        failure instanceof ConvexError ? String(failure.data) : "Something went wrong. Try again.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Shell>
      <div className="relative flex min-h-dvh flex-col px-6 py-5 md:px-9 md:py-6">
        <div className="wash-login" />

        <div className="relative">
          <Lockup />
        </div>

        <div className="relative flex flex-1 items-center">
          <div className={`w-full py-12 ${sentTo ? "max-w-capsule" : "max-w-rail"}`}>
            {sentTo ? (
              <>
                <h1 ref={heading} tabIndex={-1} className="type-display text-portal outline-none">
                  Check your <span className="text-gold italic">email</span>
                </h1>
                <p className="mt-6 text-subhead leading-copy text-neutral-body-navy">
                  We sent a sign-in link to{" "}
                  <span className="font-semibold text-neutral-ink-cream">{sentTo}</span>.
                </p>
                <p className="mt-3 text-subhead leading-copy text-neutral-body-navy">
                  It expires in 15 minutes and works once.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSentTo(null);
                    setEmail("");
                  }}
                  className="mt-8 cursor-pointer rounded-pill border border-gold/45 px-7 py-4 text-body font-medium text-neutral-ink-cream hover:border-gold"
                >
                  Use a different email
                </button>
              </>
            ) : (
              <>
                <h1 className="type-display text-portal">
                  Log <span className="text-gold italic">in</span>
                </h1>

                <form onSubmit={onSubmit} noValidate className="mt-10">
                  <label htmlFor="login-email" className="block type-label text-gold uppercase">
                    Georgia Tech email
                  </label>
                  <div className={`mt-3 border-b ${error ? "border-error" : "border-gold/45"}`}>
                    <input
                      id="login-email"
                      type="email"
                      autoComplete="email"
                      aria-invalid={error ? true : undefined}
                      aria-describedby={error ? "login-email-error" : undefined}
                      placeholder="jdoe3@gatech.edu"
                      value={email}
                      onChange={(event) => {
                        setEmail(event.target.value);
                        setError(null);
                      }}
                      className="border-0 bg-transparent px-0 text-input-hero text-neutral-ink-cream shadow-none outline-none placeholder:text-neutral-muted-navy focus:border-0 focus:shadow-none"
                    />
                  </div>
                  {error ? (
                    <p id="login-email-error" role="alert" className="mt-3 text-note text-error">
                      {error}
                    </p>
                  ) : null}

                  <button
                    type="submit"
                    disabled={pending}
                    className="mt-8 cursor-pointer rounded-pill bg-buzz px-8 py-4 text-body font-semibold whitespace-nowrap text-navy hover:opacity-[0.88] disabled:cursor-wait disabled:opacity-70"
                  >
                    {pending ? "One moment…" : "Continue"}
                  </button>
                </form>
              </>
            )}

            <div className="mt-12 border-t border-gold/22 pt-7 text-small text-neutral-body-navy">
              Not registered yet?{" "}
              <Link
                to="/register"
                search={{}}
                className="border-b border-gold font-semibold text-gold"
              >
                Become a member
              </Link>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
