import { api } from "@colorstack-gt/backend/convex/_generated/api";
import {
  OTP_ALLOWED_ATTEMPTS,
  OTP_LENGTH,
  RESEND_COOLDOWN_SECONDS,
} from "@colorstack-gt/backend/convex/lib/config";
import { isGeorgiaTechEmail, normalizeEmail } from "@colorstack-gt/backend/convex/lib/identity";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { type ConvexReactClient, useConvex } from "convex/react";
import { type FormEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { z } from "zod";

import { authClient } from "@/lib/auth-client";
import { useSlow } from "@/lib/motion";
import { forgetSession } from "@/lib/session";

import { Bar } from "./frame";
import { Message } from "./message";

const COPY = {
  "sign-in": {
    path: "/sign-in",
    title: "Sign in",
    prompt: "Not a member?",
    other: { label: "Join", to: "/join" },
  },
  join: {
    path: "/join",
    title: "Join",
    prompt: "Already a member?",
    other: { label: "Sign in", to: "/sign-in" },
  },
} as const;

const TRIES = ["No tries", "One try", "Two tries", "Three tries"];

export const solid =
  "flex h-control-lg w-full cursor-pointer items-center justify-center rounded-full bg-diploma type-nav text-navy [transition:background-color_180ms,scale_100ms] not-disabled:hover:bg-burdell motion-safe:not-disabled:active:scale-97 aria-busy:cursor-wait disabled:not-aria-busy:cursor-not-allowed disabled:not-aria-busy:bg-diploma/16 disabled:not-aria-busy:text-diploma/64";
// Onboarding's fields are the gate's size.
export const field = "h-control-lg px-5 text-subtitle roomy:px-8";
export const quiet =
  "flex min-h-12 cursor-pointer items-center justify-center rounded-full px-link-x py-2 text-center type-nav text-diploma transition-[background-color] hover:bg-diploma/13 disabled:cursor-default disabled:text-diploma/45 disabled:hover:bg-transparent";

export const gateSearch = z.object({
  email: z.string().optional().catch(undefined),
  sent: z.boolean().optional().catch(undefined),
});

export const NO_EMAIL = "Enter your Georgia Tech email.";
export const WRONG_DOMAIN = "Use your @gatech.edu email.";

const store = {
  get: (key: string) => {
    try {
      return Number(sessionStorage.getItem(key)) || 0;
    } catch {
      return 0;
    }
  },
  set: (key: string, value: number | null) => {
    try {
      if (value === null) sessionStorage.removeItem(key);
      else sessionStorage.setItem(key, String(value));
    } catch {}
  },
};

export async function sendCode(email: string): Promise<string | null> {
  const result = await authClient.emailOtp
    .sendVerificationOtp({ email, type: "sign-in" })
    .catch(() => null);
  if (result && !result.error) {
    saveTriesUsed(email, null);
    store.set(`gate-sent:${email}`, Date.now());
    return null;
  }
  return result?.error.status === 429
    ? "Too many requests. Wait a minute and try again."
    : "We couldn't send a code. Try again.";
}

// The server keeps the real count of wrong tries but never reports it, so the tab remembers its own.
const triesUsed = (email: string) => store.get(`gate-tries:${email}`);
const saveTriesUsed = (email: string, used: number | null) =>
  store.set(`gate-tries:${email}`, used);

// A reload or a step back keeps counting down from when the code was sent, not from the start.
function cooldownLeft(email: string) {
  const sent = store.get(`gate-sent:${email}`);
  if (!sent) return RESEND_COOLDOWN_SECONDS;
  return Math.max(0, RESEND_COOLDOWN_SECONDS - Math.floor((Date.now() - sent) / 1000));
}

// Onboarding opens on the member and their private answers. Watching both while Verifying… still shows, and for a
// moment after, lets its first screen arrive with them instead of a blank page.
function hold(convex: ConvexReactClient) {
  const watches = [
    convex.watchQuery(api.members.me),
    convex.watchQuery(api.members.myDemographics),
  ];
  const ready = () => {
    try {
      return (
        Boolean(watches[0]!.localQueryResult()) && watches[1]!.localQueryResult() !== undefined
      );
    } catch {
      return true;
    }
  };
  return new Promise<void>((resolve) => {
    const stops = watches.map((watch) => watch.onUpdate(() => ready() && resolve()));
    if (ready()) resolve();
    setTimeout(resolve, 4000);
    setTimeout(() => stops.forEach((stop) => stop()), 10_000);
  });
}

// The boxes only grow and shrink at the end, so edits land there wherever the hidden caret is.
function nextCode(code: string, value: string, caret: number) {
  const change = value.length - code.length;
  if (change === -1) return code.slice(0, -1);
  if (change <= 0) return value.replace(/\D/g, "").slice(0, OTP_LENGTH);
  const added = value.slice(caret - change, caret).replace(/\D/g, "");
  return (added.length >= OTP_LENGTH ? added : code + added).slice(0, OTP_LENGTH);
}

function Title({ title, line }: { title: ReactNode; line: ReactNode }) {
  return (
    <>
      <h1 id="gate-title" className="type-display text-title">
        {title}
      </h1>
      <p id="gate-line" className="mt-2 text-subtitle text-pretty text-diploma/70">
        {line}
      </p>
    </>
  );
}

function Links({ children }: { children: ReactNode }) {
  return (
    <div className="mt-3 flex flex-wrap justify-center gap-x-1 roomy:mt-6 roomy:gap-x-4">
      {children}
    </div>
  );
}

function Prompt({ prompt, action }: { prompt: string; action: string }) {
  return (
    <span>
      <span className="whitespace-nowrap text-diploma/70">{prompt}</span>{" "}
      <span className="whitespace-nowrap">{action}</span>
    </span>
  );
}

function Address({ email }: { email: string }) {
  return (
    <span className="inline-block max-w-full font-medium wrap-break-word text-diploma">
      {email}
    </span>
  );
}

function EmailStep({
  variant,
  email,
  setEmail,
  focus,
  onSent,
}: {
  variant: keyof typeof COPY;
  email: string;
  setEmail: (value: string) => void;
  focus: boolean;
  onSent: (email: string) => void;
}) {
  const copy = COPY[variant];
  const input = useRef<HTMLInputElement>(null);
  const [invalid, setInvalid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const slow = useSlow(pending);

  // With a mouse, the screen's one field takes focus; a phone's keyboard waits for a tap.
  useEffect(() => {
    if (!focus && matchMedia("(pointer: fine)").matches) input.current?.focus();
  }, [focus]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim() || !isGeorgiaTechEmail(email)) {
      setInvalid(email.trim() ? WRONG_DOMAIN : NO_EMAIL);
      input.current?.focus();
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

  const describedBy = [invalid && "gate-email-error", error && "gate-send-error"]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <Title title={copy.title} line={<>We’ll send a code to your Georgia&nbsp;Tech email.</>} />

      <form onSubmit={submit} noValidate className="mt-6 roomy:mt-8">
        <label htmlFor="gate-email" className="sr-only">
          Georgia Tech email
        </label>
        <input
          ref={input}
          id="gate-email"
          autoFocus={focus}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@gatech.edu"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setInvalid(null);
            setError(null);
          }}
          aria-invalid={invalid ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={field}
        />
        {invalid ? (
          <Message tone="error" id="gate-email-error">
            {invalid}
          </Message>
        ) : null}
        {error ? (
          <Message tone="error" id="gate-send-error">
            {error}
          </Message>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending || undefined}
          className={`mt-4 ${solid}`}
        >
          {slow ? "Sending…" : "Send code"}
        </button>
      </form>

      <Links>
        <Link to={copy.other.to} className={quiet}>
          <Prompt prompt={copy.prompt} action={copy.other.label} />
        </Link>
        {invalid === WRONG_DOMAIN ? (
          <a href="mailto:colorstackgt@gmail.com" className={quiet}>
            <Prompt prompt="Partner company?" action="Email us" />
          </a>
        ) : null}
      </Links>
    </>
  );
}

function CodeStep({ email, onChangeEmail }: { email: string; onChangeEmail: () => void }) {
  const router = useRouter();
  const navigate = useNavigate();
  const convex = useConvex();
  const input = useRef<HTMLInputElement>(null);

  const [code, setCode] = useState("");
  const [triesLeft, setTriesLeft] = useState(OTP_ALLOWED_ATTEMPTS);
  const [wrong, setWrong] = useState(false);
  const [short, setShort] = useState(false);
  const [retired, setRetired] = useState<"expired" | "used" | null>(null);
  const [pending, setPending] = useState(false);
  const [sending, setSending] = useState(false);
  const [resent, setResent] = useState(false);
  const [cooldown, setCooldown] = useState(() => cooldownLeft(email));
  const [error, setError] = useState<string | null>(null);
  const verifying = useSlow(pending);
  const resending = useSlow(sending);

  useEffect(() => {
    if (triesUsed(email) >= OTP_ALLOWED_ATTEMPTS) setRetired("used");
  }, [email]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function verify(otp: string) {
    setPending(true);
    setError(null);
    const result = await authClient.signIn.emailOtp({ email, otp }).catch(() => null);
    if (result && !result.error) {
      forgetSession();
      await router.invalidate();
      await hold(convex);
      await navigate({ to: "/onboarding" });
      return;
    }

    setPending(false);
    if (!result) {
      setError("We couldn't check that code. Try again.");
      input.current?.select();
      return;
    }
    if (result.error.code === "OTP_EXPIRED") return setRetired("expired");
    if (result.error.code === "TOO_MANY_ATTEMPTS") {
      saveTriesUsed(email, OTP_ALLOWED_ATTEMPTS);
      return setRetired("used");
    }

    const used = triesUsed(email) + 1;
    saveTriesUsed(email, used);
    const left = OTP_ALLOWED_ATTEMPTS - used;
    setTriesLeft(left);
    if (left <= 0) return setRetired("used");
    setWrong(true);
    input.current?.select();
  }

  async function resend() {
    setError(null);
    setSending(true);
    const failure = await sendCode(email);
    setSending(false);
    if (failure) {
      setError(failure);
      return;
    }
    setRetired(null);
    setCode("");
    setWrong(false);
    setShort(false);
    setTriesLeft(OTP_ALLOWED_ATTEMPTS);
    setResent(true);
    setCooldown(RESEND_COOLDOWN_SECONDS);
    requestAnimationFrame(() => input.current?.focus());
  }

  const changeEmail = (
    <button type="button" onClick={onChangeEmail} className={quiet}>
      Change email
    </button>
  );

  if (retired) {
    return (
      <div key="retired" className="animate-rise">
        <Title
          title={retired === "expired" ? "Code expired" : "Too many tries"}
          line={
            <>
              Send a new one to <Address email={email} />.
            </>
          }
        />
        <button
          type="button"
          autoFocus
          onClick={resend}
          disabled={sending}
          aria-busy={sending || undefined}
          aria-describedby="gate-title gate-line"
          className={`mt-6 roomy:mt-8 ${solid}`}
        >
          {resending ? "Sending…" : "Send new code"}
        </button>
        {error ? <Message tone="error">{error}</Message> : null}
        <Links>{changeEmail}</Links>
      </div>
    );
  }

  const current = Math.min(code.length, OTP_LENGTH - 1);
  // The resend link keeps the width of its longest label, so Change email beside it never shifts as it counts down.
  const resendLabel =
    cooldown > 0 ? `Resend in ${cooldown}s` : resending ? "Sending…" : "Resend code";

  return (
    <div key="code" className="animate-rise">
      <Title
        title="Check your email"
        line={
          <>
            We sent a code to <Address email={email} />.
          </>
        }
      />

      {/* Verify stays enabled: pressed early it says what's missing, and a wrong code is never sent twice. */}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (pending) return;
          if (code.length < OTP_LENGTH) {
            setShort(true);
            input.current?.focus();
            return;
          }
          if (wrong) return input.current?.select();
          void verify(code);
        }}
        className="mt-6 roomy:mt-8"
      >
        <div className="group relative">
          <input
            ref={input}
            autoFocus
            value={code}
            readOnly={pending}
            inputMode="numeric"
            autoComplete="one-time-code"
            aria-label={`${OTP_LENGTH}-digit code`}
            aria-invalid={wrong || short || undefined}
            aria-describedby="gate-line code-message"
            onChange={(event) => {
              const { value, selectionStart } = event.target;
              const digits = nextCode(code, value, selectionStart ?? value.length);
              if (digits === code) return;
              setCode(digits);
              setWrong(false);
              setShort(false);
              setResent(false);
              if (digits.length === OTP_LENGTH) void verify(digits);
            }}
            className="absolute inset-x-0 top-1/2 z-10 h-[max(100%,44px)] -translate-y-1/2 cursor-text bg-transparent p-0 text-base text-transparent caret-transparent outline-none selection:bg-transparent"
          />
          <div
            aria-hidden
            className={`flex justify-between gap-3 rounded-full ${wrong || short ? "outline-2 outline-offset-4 outline-azalea" : ""}`}
          >
            {Array.from({ length: OTP_LENGTH }, (_, index) => (
              <span
                key={index}
                className={`flex aspect-square max-w-control-lg flex-1 items-center justify-center rounded-full bg-navy/45 type-display text-code ${
                  code[index] ? "text-diploma" : "text-diploma/26"
                } ${
                  !wrong && !short && !pending && index === current
                    ? "group-focus-within:outline-2 group-focus-within:outline-offset-4 group-focus-within:outline-burdell"
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
            <Message tone="error">Wrong code. {TRIES[triesLeft]} left.</Message>
          ) : short ? (
            <Message tone="error">Enter the {OTP_LENGTH}-digit code.</Message>
          ) : resent ? (
            <Message tone="ok">New code sent. Earlier codes no longer work.</Message>
          ) : null}
          {error ? <Message tone="error">{error}</Message> : null}
        </div>

        <button
          type="submit"
          disabled={pending}
          aria-busy={pending || undefined}
          className={`mt-4 ${solid}`}
        >
          {verifying ? "Verifying…" : "Verify code"}
        </button>
      </form>

      <Links>
        <button
          type="button"
          onClick={resend}
          disabled={sending || cooldown > 0}
          className={`${quiet} grid tabular-nums`}
        >
          <span aria-hidden className="invisible col-start-1 row-start-1">
            Resend in {RESEND_COOLDOWN_SECONDS}s
          </span>
          <span className="col-start-1 row-start-1">{resendLabel}</span>
        </button>
        {changeEmail}
      </Links>
    </div>
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
  const navigate = useNavigate();
  const { path } = COPY[variant];
  const [email, setEmail] = useState(initial);
  const sentTo = sent && isGeorgiaTechEmail(initial) ? normalizeEmail(initial) : null;

  // The title sits where onboarding's questions put theirs, so signing in hands over without the title moving.
  return (
    <div className="min-h-dvh bg-blue-bright px-edge pt-title pb-10 roomy:pb-16">
      <Bar />
      <main className="mx-auto w-full max-w-gate">
        {sentTo ? (
          <CodeStep
            key={sentTo}
            email={sentTo}
            onChangeEmail={() =>
              void navigate({ to: path, search: { email: sentTo }, replace: true })
            }
          />
        ) : (
          <div key="email" className="animate-rise">
            <EmailStep
              variant={variant}
              email={email}
              setEmail={setEmail}
              focus={Boolean(initial)}
              onSent={(address) =>
                void navigate({ to: path, search: { email: address, sent: true } })
              }
            />
          </div>
        )}
      </main>
    </div>
  );
}
