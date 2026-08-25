/**
 * Label + control + helper/error, wired together for screen readers.
 *
 * The error replaces the helper text rather than stacking under it, and is
 * announced politely so a keyboard user hears it without losing their place
 * (PRD 9.7, 9.9).
 */

import { useId, type ReactNode } from "react";

interface FieldProps {
  label: string;
  /** Rendered under the control when there is no error. */
  hint?: ReactNode;
  error?: string | null;
  /** Right-aligned next to the label -- character counters live here. */
  adornment?: ReactNode;
  required?: boolean;
  children: (ids: {
    id: string;
    describedBy: string | undefined;
    invalid: boolean;
  }) => ReactNode;
}

export function Field({
  label,
  hint,
  error,
  adornment,
  required = false,
  children,
}: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = error ? errorId : hint ? hintId : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
          {required && (
            <span className="ml-1 text-danger" aria-hidden="true">
              *
            </span>
          )}
        </label>
        {adornment}
      </div>

      {children({ id, describedBy, invalid: Boolean(error) })}

      {error ? (
        <p id={errorId} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-sm text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export const controlClasses =
  "w-full rounded-md border bg-raised px-3 text-base text-ink " +
  "placeholder:text-ink-muted transition-colors duration-[120ms] ease-chitra " +
  "hover:not-disabled:border-line-strong " +
  "disabled:cursor-not-allowed disabled:opacity-55";

export function controlBorder(invalid: boolean) {
  return invalid ? "border-danger" : "border-line";
}
