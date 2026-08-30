import type { ReactNode } from "react";

export function Shell({ children }: { children: ReactNode }) {
  return <div className="min-h-dvh bg-navy text-neutral-ink-cream">{children}</div>;
}
