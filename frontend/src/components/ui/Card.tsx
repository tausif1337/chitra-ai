import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** `flat` sits directly on the canvas; `raised` lifts off it. */
  tone?: "flat" | "raised";
  padded?: boolean;
}

export function Card({
  children,
  tone = "flat",
  padded = true,
  className = "",
  ...props
}: CardProps) {
  return (
    <div
      className={[
        "rounded-xl border border-line bg-surface",
        tone === "raised" ? "shadow-md" : "shadow-sm",
        padded ? "p-5 sm:p-6" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  as?: "h2" | "h3";
}

export function CardHeader({ title, description, action, as: Tag = "h2" }: CardHeaderProps) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <Tag className="text-lg text-ink">{title}</Tag>
        {description && (
          <p className="mt-1 text-sm text-ink-secondary">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
