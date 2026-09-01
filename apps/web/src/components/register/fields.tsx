import type { ReactNode } from "react";

function Asterisk() {
  return (
    <span aria-hidden className="ml-1 text-error">
      *
    </span>
  );
}

function Check({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden className={`shrink-0 ${className}`}>
      <path
        d="M3.8 10.6 7.9 14.7 16.2 5.6"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Cross({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden className={`shrink-0 ${className}`}>
      <path
        d="M5.4 5.4 14.6 14.6M14.6 5.4 5.4 14.6"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** One titled part of a chapter. Its heading is what the rail scrolls to. */
export function Section({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-10">
      <div className="flex items-center gap-4">
        <h3
          id={id}
          tabIndex={-1}
          className="scroll-mt-7 type-label text-gold-dark uppercase outline-none"
        >
          {label}
        </h3>
        <span className="h-px flex-1 bg-neutral-rule-cream" />
      </div>
      {children}
    </section>
  );
}

export function Field({
  id,
  label,
  error,
  required,
  className,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-2 block type-label text-neutral-label-cream">
        {label}
        {required ? <Asterisk /> : null}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-2 text-note text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** A Field for controls that have no single element to label, such as chips. */
export function FieldGroup({
  id,
  label,
  hint,
  error,
  required,
  className,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <p id={`${id}-label`} className="mb-2 type-label text-neutral-label-cream">
        {label}
        {required ? <Asterisk /> : null}
      </p>
      {hint ? <p className="mb-3 text-detail text-neutral-body-cream">{hint}</p> : null}
      <div role="group" aria-labelledby={`${id}-label`}>
        {children}
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-2 text-note text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TextInput({
  id,
  error,
  required,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { id: string; error?: string }) {
  return (
    <input
      id={id}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${id}-error` : undefined}
      aria-required={required || undefined}
      {...props}
    />
  );
}

export function Select({
  id,
  error,
  required,
  placeholder,
  options,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  id: string;
  error?: string;
  placeholder: string;
  options: readonly { value: string; label: string }[];
}) {
  return (
    <select
      id={id}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${id}-error` : undefined}
      aria-required={required || undefined}
      {...props}
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

export function Chip({
  label,
  selected,
  onToggle,
}: {
  label: string;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      className={`flex cursor-pointer items-center gap-2 rounded-pill border px-5 py-3 text-small transition-colors ${
        selected
          ? "border-navy bg-navy font-semibold text-diploma"
          : "border-neutral-border-input bg-white text-neutral-ink-navy hover:border-gold"
      }`}
    >
      {selected ? <Check className="size-3.75 text-buzz" /> : null}
      {label}
    </button>
  );
}

/** A two-button yes/no. Labelled by the FieldGroup it sits in. */
export function YesNo({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const style = (pressed: boolean) =>
    `flex size-touch cursor-pointer items-center justify-center rounded-input border transition-colors ${
      pressed
        ? "border-navy bg-navy text-buzz"
        : "border-neutral-border-input bg-white text-neutral-placeholder hover:border-gold"
    }`;

  return (
    <div className="flex gap-2">
      <button
        type="button"
        aria-label="Yes"
        aria-pressed={value === "yes"}
        onClick={() => onChange("yes")}
        className={style(value === "yes")}
      >
        <Check className="size-4.75" />
      </button>
      <button
        type="button"
        aria-label="No"
        aria-pressed={value === "no"}
        onClick={() => onChange("no")}
        className={style(value === "no")}
      >
        <Cross className="size-4.25" />
      </button>
    </div>
  );
}
