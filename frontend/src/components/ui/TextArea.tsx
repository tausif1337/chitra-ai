import type { ComponentPropsWithRef } from "react";

import { controlBorder, controlClasses } from "./Field";

interface TextAreaProps extends ComponentPropsWithRef<"textarea"> {
  invalid?: boolean;
}

export function TextArea({ invalid = false, className = "", ...props }: TextAreaProps) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={[
        controlClasses,
        controlBorder(invalid),
        "min-h-32 resize-y py-2.5 leading-relaxed",
        className,
      ].join(" ")}
      {...props}
    />
  );
}
