/**
 * Inline status message.
 *
 * Errors render next to the action that caused them rather than in a corner
 * toast (PRD 9.7), so this is a block element the caller places deliberately.
 */

import type { ReactNode } from "react";

import { AlertIcon, CheckIcon, InfoIcon } from "./Icons";

type Tone = "error" | "success" | "info" | "warning";

const tones: Record<Tone, { wrapper: string; icon: typeof AlertIcon }> = {
  error: { wrapper: "border-danger/45 bg-danger-soft text-ink", icon: AlertIcon },
  success: { wrapper: "border-success/45 bg-success-soft text-ink", icon: CheckIcon },
  warning: { wrapper: "border-warning/45 bg-warning-soft text-ink", icon: AlertIcon },
  info: { wrapper: "border-line bg-inset text-ink", icon: InfoIcon },
};

const iconColour: Record<Tone, string> = {
  error: "text-danger",
  success: "text-success",
  warning: "text-warning",
  info: "text-ink-secondary",
};

interface AlertProps {
  tone?: Tone;
  title?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function Alert({ tone = "info", title, children, action, className = "" }: AlertProps) {
  const { wrapper, icon: Glyph } = tones[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`flex items-start gap-3 rounded-lg border px-3.5 py-3 ${wrapper} ${className}`}
    >
      <Glyph size={18} className={`mt-0.5 shrink-0 ${iconColour[tone]}`} />
      <div className="min-w-0 flex-1">
        {title && <p className="text-sm font-semibold">{title}</p>}
        <div className="text-sm text-ink-secondary">{children}</div>
        {action && <div className="mt-2.5">{action}</div>}
      </div>
    </div>
  );
}
