import * as React from "react"

import { cn } from "@/utils"

export type DivProps = React.DetailedHTMLProps<
  React.HTMLAttributes<HTMLDivElement>,
  HTMLDivElement
>

export const TabsList: React.FC<DivProps> = ({ className, children }) => (
  <div
    className={cn(
      "inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
      className,
    )}
  >
    {children}
  </div>
)

export const TabsTrigger: React.FC<DivProps & { active?: boolean }> = ({
  className,
  children,
  active,
  ...props
}) => (
  <div
    {...props}
    className={cn(
      "cursor-pointer inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
      "border border-primary/50",
      active ? "bg-primary/50 text-foreground shadow-xs" : "",
      className,
    )}
  >
    {children}
  </div>
)
