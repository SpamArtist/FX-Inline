import * as React from "react"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={className ? `ccx-ui-input ${className}` : "ccx-ui-input"}
      {...props}
    />
  )
}

export { Input }
