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
      className={`mt-5 max-w-[48ch] border-l-2 pl-3 text-note ${
        tone === "error" ? "border-azalea text-diploma" : "border-burdell text-burdell"
      }`}
    >
      {children}
    </p>
  );
}
