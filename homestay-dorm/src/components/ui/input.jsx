import * as React from "react"
import { cn } from "@/lib/utils"

const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-11 w-full rounded-lg border-[1.5px] border-cream-dark bg-white px-4 py-2 text-sm transition-all",
        "placeholder:text-ink-muted",
        "focus-visible:outline-none focus-visible:border-terracotta-500 focus-visible:ring-2 focus-visible:ring-terracotta-500/20",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "file:border-0 file:bg-transparent file:text-sm file:font-medium",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Input.displayName = "Input"

export { Input }
