import { createFileRoute } from "@tanstack/react-router";

import { Shell } from "@/components/shell";

export const Route = createFileRoute("/login")({
  component: Login,
});

function Login() {
  return (
    <Shell>
      <div>
        <div className="relative flex min-h-dvh flex-col justify-center bg-navy px-6 py-10 text-neutral-ink-cream">
          <div className="wash-login" />
          <div className="relative">
            <p className="type-label text-neutral-muted-navy">Step 04</p>
            <h1 className="mt-4 type-display text-portal">
              Member <span className="text-gold italic">portal</span>
            </h1>
            <p className="mt-6 text-subhead leading-copy text-neutral-body-navy">
              Log in is not built yet.
            </p>
          </div>
        </div>
      </div>
    </Shell>
  );
}
