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
    <div className={`mt-3.75 max-w-form ${className}`}>
      <label htmlFor={htmlFor} className="mb-1.75 block type-label text-diploma/52">
        {label}
      </label>
      {children}
      {error ? (
        <p
          id={`${htmlFor}-error`}
          className="mt-1.75 border-l-2 border-azalea pl-2 text-hint text-diploma"
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
    <div className="mt-3.75 max-w-form">
      <p id={`${id}-label`} className="mb-1.75 type-label text-diploma/52">
        {label}
      </p>
      <div role="group" aria-labelledby={`${id}-label`}>
        {children}
      </div>
      {hint ? <p className="mt-1.75 max-w-[54ch] text-hint text-diploma/52">{hint}</p> : null}
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
    <div className="relative">
      <select
        id={id}
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value as T | "")}
        className={`cursor-pointer appearance-none pr-9 [&>option]:bg-navy [&>option]:text-diploma ${
          value ? "text-diploma" : "text-diploma/60"
        }`}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <span
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-4 size-1.5 translate-y-[-70%] rotate-45 border-r-[1.5px] border-b-[1.5px] border-diploma/52"
      />
    </div>
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
    <div className="flex flex-wrap gap-1.75">
      {options.map((option) => {
        const on = selected.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(option.value)}
            className={`inline-flex min-h-control-sm cursor-pointer items-center px-3.5 py-1.5 font-mono text-button pointer-coarse:min-h-control-touch ${
              on
                ? "bg-diploma text-navy"
                : option.value === quiet
                  ? "text-diploma/52 inset-ring inset-ring-diploma/14 hover:text-burdell"
                  : "text-diploma/72 inset-ring inset-ring-diploma/22 hover:text-burdell"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

const buttonClass = "inline-flex h-control cursor-pointer items-center px-5.5 type-button";

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
  return (
    <div className="flex items-center justify-between gap-5">
      <div className="flex max-w-47.5 flex-1 gap-1.25">
        {step !== undefined && total !== undefined ? (
          <>
            <p className="sr-only">
              Screen {step + 1} of {total}
            </p>
            {Array.from({ length: total }, (_, index) => (
              <span
                key={index}
                aria-hidden
                className={`h-1 flex-1 ${
                  index < step ? "bg-diploma" : index === step ? "bg-buzz" : "bg-diploma/16"
                }`}
              />
            ))}
          </>
        ) : null}
      </div>
      <div className="flex flex-none items-center gap-2.5">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className={`${buttonClass} text-diploma inset-ring inset-ring-diploma/22 hover:text-burdell`}
          >
            Back
          </button>
        ) : null}
        <button
          type="button"
          onClick={forward.onClick}
          disabled={forward.disabled}
          className={`${buttonClass} bg-buzz text-navy disabled:cursor-not-allowed disabled:bg-buzz/30 disabled:text-navy/55`}
        >
          {forward.label}
        </button>
      </div>
    </div>
  );
}
