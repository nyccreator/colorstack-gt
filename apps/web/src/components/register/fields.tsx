import type { ReactNode } from "react";

function Asterisk() {
  return (
    <span aria-hidden className="ml-1 text-error">
      *
    </span>
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
      className={`cursor-pointer rounded-input border px-5 py-3 text-small transition-colors ${
        selected
          ? "border-navy bg-navy font-semibold text-diploma"
          : "border-neutral-border-input bg-white text-neutral-ink-navy hover:border-gold"
      }`}
    >
      {label}
    </button>
  );
}
