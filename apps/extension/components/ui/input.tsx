import * as React from "react"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
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
