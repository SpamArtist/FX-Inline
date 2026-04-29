import type { ComponentProps } from "preact";

function Input({ className, type, ...props }: ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={`fx-inline-ui-input${className ? ` ${className}` : ""}`}
      {...props}
    />
  )
}

export { Input }
