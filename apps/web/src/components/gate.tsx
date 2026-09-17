import {
  OTP_ALLOWED_ATTEMPTS,
  OTP_EXPIRY_SECONDS,
  OTP_LENGTH,
  RESEND_COOLDOWN_SECONDS,
} from "@colorstack-gt/backend/convex/lib/config";
import { isGeorgiaTechEmail, normalizeEmail } from "@colorstack-gt/backend/convex/lib/identity";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { type FormEvent, type ReactNode, useEffect, useRef, useState } from "react";

import { authClient } from "@/lib/auth-client";

import { Frame } from "./frame";
import { Message } from "./message";

const COPY = {
  "sign-in": {
    title: "Sign in.",
    prompt: "New to ColorStack GT?",
    other: { label: "Join", to: "/join" },
  },
  join: {
    title: "Join ColorStack GT.",
    prompt: "Already a member?",
    other: { label: "Sign in", to: "/sign-in" },
  },
} as const;

const TRIES = ["no tries", "one try", "two tries", "three tries"];

export const WRONG_DOMAIN =
  "Membership is for Georgia Tech students. Please use your @gatech.edu address.";

export async function sendCode(email: string): Promise<string | null> {
  const { error } = await authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" });
  if (!error) return null;
  return error.status === 429
    ? "Too many requests. Wait a minute and try again."
    : "We couldn't send a code. Try again.";
}

const linkClass = "border-b border-buzz/40 text-buzz hover:text-burdell";

function Heading({ eyebrow, title, lede }: { eyebrow: string; title: string; lede: ReactNode }) {
  return (
    <>
      <p className="mb-3 type-eyebrow text-diploma/52">{eyebrow}</p>
      <h1 className="type-display text-gate">{title}</h1>
      <p className="mt-3.5 max-w-[44ch] text-lede-gate text-diploma/72">{lede}</p>
    </>
  );
}

function EmailStep({
  variant,
  email,
  setEmail,
  onSent,
}: {
  variant: keyof typeof COPY;
  email: string;
  setEmail: (value: string) => void;
  onSent: (email: string) => void;
}) {
  const copy = COPY[variant];
  const [wrongDomain, setWrongDomain] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isGeorgiaTechEmail(email)) {
      setWrongDomain(true);
      return;
    }

    setPending(true);
    const address = normalizeEmail(email);
    const failure = await sendCode(address);
    setPending(false);

    if (failure) {
      setError(failure);
      return;
    }
    onSent(address);
  }

  return (
    <>
      <Heading
        eyebrow="ColorStack at Georgia Tech"
        title={copy.title}
        lede="We'll email you a six-digit code. You'll need your Georgia Tech address."
      />

      <form onSubmit={submit} noValidate className="mt-6 flex max-w-field">
        <label htmlFor="gate-email" className="sr-only">
          Georgia Tech email
        </label>
        <input
          id="gate-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@gatech.edu"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setWrongDomain(false);
            setError(null);
          }}
          aria-invalid={wrongDomain || undefined}
          aria-describedby={wrongDomain ? "gate-email-error" : undefined}
          className="min-w-0 flex-1 border-r-0 px-3.5 text-note pointer-coarse:text-base"
        />
        <button
          type="submit"
          disabled={pending || wrongDomain}
          className="h-control flex-none cursor-pointer bg-buzz px-5.5 type-button text-navy disabled:cursor-default disabled:bg-diploma/16 disabled:text-diploma/52"
        >
          {pending ? "Sending" : "Send code"}
        </button>
      </form>

      {wrongDomain ? (
        <Message tone="error" id="gate-email-error">
          {WRONG_DOMAIN}
        </Message>
      ) : null}
      {error ? <Message tone="error">{error}</Message> : null}

      <p className="mt-4 max-w-[44ch] text-note text-diploma/52">
        {wrongDomain ? (
          <>
            Are you with a partner company?{" "}
            <a href="mailto:board@colorstackgt.org" className={linkClass}>
              Email the e-board
            </a>
            .
          </>
        ) : (
          <>
            {copy.prompt}{" "}
            <Link to={copy.other.to} className={linkClass}>
              {copy.other.label}
            </Link>
            .
          </>
        )}
      </p>
    </>
  );
}

function CodeStep({ email, onChangeEmail }: { email: string; onChangeEmail: () => void }) {
  const router = useRouter();
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);

  const [code, setCode] = useState("");
  const [focused, setFocused] = useState(false);
  const [triesLeft, setTriesLeft] = useState(OTP_ALLOWED_ATTEMPTS);
  const [wrong, setWrong] = useState(false);
  const [retired, setRetired] = useState<"expired" | "used" | null>(null);
  const [pending, setPending] = useState(false);
  const [resent, setResent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function verify(otp: string) {
    setPending(true);
    const { error } = await authClient.signIn.emailOtp({ email, otp });
    if (!error) {
      await router.invalidate();
      await navigate({ to: "/onboarding" });
      return;
    }

    setPending(false);
    if (error.code === "OTP_EXPIRED") return setRetired("expired");
    if (error.code === "TOO_MANY_ATTEMPTS") return setRetired("used");

    const left = triesLeft - 1;
    setTriesLeft(left);
    if (left <= 0) return setRetired("used");
    setWrong(true);
    requestAnimationFrame(() => input.current?.select());
  }

  async function resend() {
    setError(null);
    const failure = await sendCode(email);
    if (failure) {
      setError(failure);
      return;
    }
    setRetired(null);
    setCode("");
    setWrong(false);
    setTriesLeft(OTP_ALLOWED_ATTEMPTS);
    setResent(true);
    setCooldown(RESEND_COOLDOWN_SECONDS);
    requestAnimationFrame(() => input.current?.focus());
  }

  if (retired) {
    return (
      <>
        <Heading
          eyebrow="Check your Georgia Tech mail"
          title={retired === "expired" ? "That code has expired." : "That code has been used."}
          lede={
            <>
              {retired === "expired"
                ? `Codes are good for ${OTP_EXPIRY_SECONDS / 60} minutes.`
                : "A code stops working after three wrong tries."}{" "}
              We can send a new one to {email}.
            </>
          }
        />
        <button
          type="button"
          onClick={resend}
          className="mt-5.5 flex h-control w-full max-w-field cursor-pointer items-center justify-center bg-buzz px-5.5 type-button text-navy"
        >
          Send a new code
        </button>
        <button
          type="button"
          onClick={onChangeEmail}
          className="mt-2.75 flex h-control w-full max-w-field cursor-pointer items-center justify-center px-5.5 type-button text-diploma inset-ring inset-ring-diploma/22 hover:text-burdell"
        >
          Use a different address
        </button>
        {error ? <Message tone="error">{error}</Message> : null}
      </>
    );
  }

  const current = Math.min(code.length, OTP_LENGTH - 1);

  return (
    <>
      <Heading
        eyebrow="Check your Georgia Tech mail"
        title="Enter your code."
        lede={
          <>
            We sent it to {email}. It expires in {OTP_EXPIRY_SECONDS / 60} minutes.
          </>
        }
      />

      <div className="relative mt-6 max-w-field">
        <input
          ref={input}
          autoFocus
          value={code}
          disabled={pending}
          inputMode="numeric"
          autoComplete="one-time-code"
          aria-label={`${OTP_LENGTH}-digit code`}
          aria-invalid={wrong || undefined}
          aria-describedby="code-message"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, "").slice(0, OTP_LENGTH);
            setCode(digits);
            setWrong(false);
            if (digits.length === OTP_LENGTH) void verify(digits);
          }}
          className="absolute inset-0 z-10 h-full cursor-text border-transparent bg-transparent p-0 text-base text-transparent caret-transparent selection:bg-transparent focus-visible:outline-none"
        />
        <div aria-hidden className="flex gap-3">
          {Array.from({ length: OTP_LENGTH }, (_, index) => (
            <span
              key={index}
              className={`flex aspect-3/4 flex-1 items-center justify-center border bg-diploma/9 font-mono text-code ${
                wrong ? "border-azalea/60" : "border-diploma/22"
              } ${code[index] ? "text-diploma" : "text-diploma/22"} ${
                focused && !pending && index === current
                  ? "outline-2 outline-offset-3 outline-burdell"
                  : ""
              }`}
            >
              {code[index] ?? "–"}
            </span>
          ))}
        </div>
      </div>

      <div id="code-message">
        {wrong ? (
          <Message tone="error">That code isn't right. You have {TRIES[triesLeft]} left.</Message>
        ) : resent && cooldown > 0 ? (
          <Message tone="ok">
            We sent another code. You can ask for one more in {cooldown}s.
          </Message>
        ) : null}
        {error ? <Message tone="error">{error}</Message> : null}
      </div>

      <p className="mt-4 max-w-[44ch] text-note text-diploma/52">
        {resent ? "If it hasn't arrived, check your Junk folder." : "Didn't arrive?"}{" "}
        {cooldown > 0 ? null : (
          <>
            <button type="button" onClick={resend} className={`cursor-pointer ${linkClass}`}>
              Resend
            </button>{" "}
            ·{" "}
          </>
        )}
        <button type="button" onClick={onChangeEmail} className={`cursor-pointer ${linkClass}`}>
          Use a different address
        </button>
      </p>
    </>
  );
}

export function Gate({
  variant,
  email: initial = "",
  sent = false,
}: {
  variant: keyof typeof COPY;
  email?: string;
  sent?: boolean;
}) {
  const [email, setEmail] = useState(initial);
  const [sentTo, setSentTo] = useState<string | null>(
    sent && isGeorgiaTechEmail(initial) ? normalizeEmail(initial) : null,
  );

  return (
    <Frame>
      {sentTo ? (
        <CodeStep email={sentTo} onChangeEmail={() => setSentTo(null)} />
      ) : (
        <EmailStep variant={variant} email={email} setEmail={setEmail} onSent={setSentTo} />
      )}
    </Frame>
  );
}
