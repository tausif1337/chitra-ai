interface SkeletonProps {
  className?: string;
  /** Skeletons are decorative; the surrounding region announces the loading. */
  rounded?: "md" | "lg" | "xl" | "full";
}

export function Skeleton({ className = "", rounded = "md" }: SkeletonProps) {
  const radius = {
    md: "rounded-md",
    lg: "rounded-lg",
    xl: "rounded-xl",
    full: "rounded-full",
  }[rounded];

  return (
    <div aria-hidden="true" className={`chitra-shimmer bg-inset ${radius} ${className}`} />
  );
}
