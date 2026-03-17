import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"

import { cn } from "@/utils/utils"

function Label({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn("ccx-ui-label", className)}
      {...props}
    />
  )
}

export { Label }
