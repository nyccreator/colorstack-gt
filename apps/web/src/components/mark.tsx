const SOURCES = {
  lockup: "/assets/logos/colorstack-gt-dark.svg",
  buzz: "/assets/art/buzz.svg",
} as const;

export function Mark({
  mark,
  label,
  className = "",
}: {
  mark: keyof typeof SOURCES;
  label?: string;
  className?: string;
}) {
  return <img src={SOURCES[mark]} alt={label ?? ""} className={`block ${className}`} />;
}
