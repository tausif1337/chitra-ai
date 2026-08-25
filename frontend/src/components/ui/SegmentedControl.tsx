/**
 * Radio group styled as a segmented control.
 *
 * A native `<select>` hides the choices behind a click; the size and quality
 * options are few and consequential, so they stay visible (PRD 9.12: keep the
 * primary workflow immediately understandable). Built on real radio inputs so
 * arrow keys, labels, and form semantics come for free.
 */

import { useId, type ReactNode } from "react";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  /** Small second line, e.g. an aspect ratio. */
  detail?: ReactNode;
}

interface SegmentedControlProps<T extends string> {
  legend: string;
  name?: string;
  value: T;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  describedBy?: string;
  columns?: number;
}

export function SegmentedControl<T extends string>({
  legend,
  name,
  value,
  options,
  onChange,
  disabled = false,
  describedBy,
  columns,
}: SegmentedControlProps<T>) {
  const generatedName = useId();
  const groupName = name ?? generatedName;

  return (
    <fieldset
      className="min-w-0 border-0 p-0 m-0"
      disabled={disabled}
      aria-describedby={describedBy}
    >
      <legend className="sr-only">{legend}</legend>
      <div
        className="grid gap-1.5 rounded-lg border border-line bg-inset p-1.5"
        style={{ gridTemplateColumns: `repeat(${columns ?? options.length}, minmax(0, 1fr))` }}
      >
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <label
              key={option.value}
              className={[
                "group relative flex cursor-pointer flex-col items-center justify-center",
                "gap-0.5 rounded-md px-2 py-2 text-center transition-colors",
                "duration-[120ms] ease-chitra",
                selected
                  ? "bg-raised text-ink shadow-sm"
                  : "text-ink-secondary hover:bg-raised/60 hover:text-ink",
                disabled ? "cursor-not-allowed opacity-55" : "",
                "has-[:focus-visible]:outline has-[:focus-visible]:outline-2",
                "has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus",
              ].join(" ")}
            >
              <input
                type="radio"
                name={groupName}
                value={option.value}
                checked={selected}
                disabled={disabled}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              <span className="text-sm font-medium leading-tight">{option.label}</span>
              {option.detail && (
                <span className="text-xs text-ink-muted leading-tight">{option.detail}</span>
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
