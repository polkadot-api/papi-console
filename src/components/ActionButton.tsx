import { ButtonHTMLAttributes, forwardRef } from "react"
import { twMerge } from "tailwind-merge"

export const ActionButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement>
>((props, ref) => (
  <button
    {...props}
    ref={ref}
    className={twMerge(
      "text-accent-foreground bg-accent/90 px-3 py-1",
      "cursor-pointer select-none hover:bg-accent",
      props.disabled && "opacity-50 pointer-events-none",
      props.className,
    )}
  />
))
