import type { ReactNode } from "react";

export function Heading({
  eyebrow,
  title,
  lede,
  size = "gate",
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  lede?: ReactNode;
  size?: "gate" | "step";
}) {
  return (
    <>
      <p className="type-eyebrow text-diploma/86">{eyebrow}</p>
      <h1 className={`mt-3.5 type-display ${size === "gate" ? "text-gate" : "text-step"}`}>
        {title}
      </h1>
      {lede ? <p className="mt-4.5 max-w-[46ch] text-lede-gate text-diploma/86">{lede}</p> : null}
    </>
  );
}
