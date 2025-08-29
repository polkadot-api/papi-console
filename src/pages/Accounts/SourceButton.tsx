import { Button } from "@/components/ui/button"
import { cn } from "@/utils"
import { FC, MouseEvent, PropsWithChildren } from "react"

export const SourceButton: FC<
  PropsWithChildren<{
    label: string
    isSelected?: boolean
    className?: string
    onClick?: (evt: MouseEvent) => void
    disabled?: boolean
  }>
> = ({ label, isSelected, onClick, className, children, disabled }) => (
  <Button
    variant="outline"
    className={cn("h-auto min-w-40", isSelected ? "bg-accent" : "")}
    onClick={onClick}
    disabled={disabled}
    forceSvgSize={false}
  >
    {children}
    <div className="text-left">
      <span className={cn("font-bold", className)}>{label}</span>
    </div>
  </Button>
)
