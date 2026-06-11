import * as React from "react"
import { cn } from "@/lib/utils"
import { cva } from "class-variance-authority"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-terracotta-500 text-white hover:bg-terracotta-600 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-terracotta-500/30",
        outline: "border-[1.5px] border-cream-dark bg-transparent text-ink hover:border-terracotta-500 hover:text-terracotta-500 hover:bg-warm-white",
        ghost: "text-ink-soft hover:bg-warm-white hover:text-ink",
        secondary: "bg-secondary text-secondary-foreground hover:bg-cream-dark",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        link: "text-terracotta-500 underline-offset-4 hover:underline",
        mint: "bg-mint text-white hover:bg-mint-dark",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-9 px-4 text-xs",
        lg: "h-12 px-7 text-base",
        xl: "h-14 px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef(({ className, variant, size, ...props }, ref) => {
  return (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  )
})
Button.displayName = "Button"

export { Button, buttonVariants }
