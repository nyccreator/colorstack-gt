import type { ReactNode } from "react";

export function Field({
  label,
  htmlFor,
  error,
  className = "",
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`mt-6 max-w-form ${className}`}>
      <label htmlFor={htmlFor} className="mb-2.5 block type-label text-diploma">
        {label}
      </label>
      {children}
      {error ? (
        <p
          id={`${htmlFor}-error`}
          className="mt-2 border-l-2 border-azalea pl-2.5 text-hint text-diploma"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Group({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-6 max-w-form">
      <p id={`${id}-label`} className="mb-2.5 type-label text-diploma">
        {label}
      </p>
      <div role="group" aria-labelledby={`${id}-label`}>
        {children}
      </div>
      {hint ? <p className="mt-2 max-w-[54ch] text-hint text-diploma/86">{hint}</p> : null}
    </div>
  );
}

export function Select<T extends string>({
  id,
  value,
  onChange,
  options,
  placeholder,
  label,
}: {
  id: string;
  label?: string;
  value: T | "";
  onChange: (value: T | "") => void;
  options: readonly { value: T; label: string }[];
  placeholder: string;
}) {
  return (
    <select
      id={id}
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value as T | "")}
      className={`cursor-pointer ${value ? "text-diploma" : "text-diploma/64"}`}
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function Chips<T extends string>({
  options,
  selected,
  onToggle,
  quiet,
}: {
  options: readonly { value: T; label: string }[];
  selected: readonly T[];
  onToggle: (value: T) => void;
  quiet?: T;
}) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {options.map((option) => {
        const on = selected.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(option.value)}
            className={`inline-flex min-h-control-sm cursor-pointer items-center rounded-full border px-4.5 text-note pointer-coarse:min-h-control-touch ${
              on
                ? "border-diploma bg-diploma text-navy"
                : option.value === quiet
                  ? "border-diploma/34 text-diploma/86 hover:border-burdell hover:text-burdell"
                  : "border-diploma/34 text-diploma hover:border-burdell hover:text-burdell"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

const buttonClass =
  "inline-flex h-control flex-none cursor-pointer items-center justify-center rounded-full px-[clamp(18px,2.2vw,30px)] type-button";

export const primaryButton = `${buttonClass} bg-diploma text-navy disabled:cursor-not-allowed disabled:bg-diploma/16 disabled:text-diploma/64`;
export const ghostButton = `${buttonClass} border border-diploma/55 text-diploma hover:border-burdell hover:text-burdell`;

export function Footbar({
  step,
  total,
  onBack,
  forward,
}: {
  step?: number;
  total?: number;
  onBack?: () => void;
  forward: { label: string; onClick: () => void; disabled?: boolean };
}) {
  const ticks = step !== undefined && total !== undefined;

  return (
    <div className="flex flex-wrap items-center justify-end gap-3 px-edge py-[clamp(16px,2.4vh,26px)] shell:justify-between">
      {ticks ? (
        <>
          <p className="sr-only">
            Screen {step + 1} of {total}
          </p>
          <div className="fixed inset-x-edge top-[calc(var(--spacing-bar)+18px)] z-30 flex gap-1.5 shell:static shell:max-w-70 shell:flex-1">
            {Array.from({ length: total }, (_, index) => (
              <span
                key={index}
                aria-hidden
                className={`h-1 flex-1 ${
                  index < step ? "bg-diploma" : index === step ? "bg-burdell" : "bg-diploma/20"
                }`}
              />
            ))}
          </div>
        </>
      ) : null}
      <div className="flex flex-none items-center gap-3">
        {onBack ? (
          <button type="button" onClick={onBack} className={ghostButton}>
            Back
          </button>
        ) : null}
        <button
          type="button"
          onClick={forward.onClick}
          disabled={forward.disabled}
          className={primaryButton}
        >
          {forward.label}
        </button>
      </div>
    </div>
  );
}
