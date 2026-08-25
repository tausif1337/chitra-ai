import type { ComponentPropsWithRef } from "react";

import { controlBorder, controlClasses } from "./Field";

interface TextInputProps extends ComponentPropsWithRef<"input"> {
  invalid?: boolean;
}

export function TextInput({ invalid = false, className = "", ...props }: TextInputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={[controlClasses, controlBorder(invalid), "h-10", className].join(" ")}
      {...props}
    />
  );
}
