import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"

function Label({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={className ? `ccx-ui-label ${className}` : "ccx-ui-label"}
      {...props}
    />
  )
}

export { Label }
