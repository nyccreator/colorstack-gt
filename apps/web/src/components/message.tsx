import type { ReactNode } from "react";

export function ErrorBadge({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-grid size-[1.15em] flex-none place-items-center rounded-full bg-azalea font-display leading-none font-bold text-diploma ${className}`}
    >
      !
    </span>
  );
}

export function Message({
  tone,
  id,
  centered,
  className = "",
  children,
}: {
  tone: "error" | "ok";
  id?: string;
  centered?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const color = tone === "error" ? "text-diploma" : "text-burdell";
  const role = tone === "error" ? "alert" : "status";

  if (centered) {
    return (
      <p
        id={id}
        role={role}
        className={`mt-4 text-center text-message text-balance ${color} ${className}`}
      >
        {tone === "error" ? <ErrorBadge className="mr-2" /> : null}
        {children}
      </p>
    );
  }

  return (
    <p
      id={id}
      role={role}
      className={`mt-4 flex items-baseline gap-2 text-message ${color} ${className}`}
    >
      {tone === "error" ? <ErrorBadge /> : null}
      <span className="text-pretty">{children}</span>
    </p>
  );
}
