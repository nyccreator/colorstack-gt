import type { ReactNode } from "react";

export function Message({
  tone,
  id,
  children,
}: {
  tone: "error" | "ok";
  id?: string;
  children: ReactNode;
}) {
  return (
    <p
      id={id}
      role={tone === "error" ? "alert" : "status"}
      className={`mt-4 max-w-[44ch] border-l-2 pl-2.75 font-mono text-hint ${
        tone === "error" ? "border-azalea text-diploma" : "border-burdell text-burdell"
      }`}
    >
      {children}
    </p>
  );
}
