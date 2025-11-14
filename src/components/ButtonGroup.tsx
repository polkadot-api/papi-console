import * as ToggleGroup from "@radix-ui/react-toggle-group"
import { FC, ReactNode } from "react"
import { twMerge } from "tailwind-merge"

export const ButtonGroup: FC<{
  items: Array<{
    value: string
    content: ReactNode
    disabled?: boolean
  }>
  value: string
  onValueChange: (value: string) => void
  btnWidth?: number
}> = ({ items, value, onValueChange, btnWidth }) => {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(v) => v && onValueChange(v)}
      className="inline-flex border border-accent bg-background text-foreground"
    >
      {items.map(({ value, content, disabled }) => (
        <ToggleGroup.Item
          value={value}
          key={value}
          className={twMerge(
            "text-secondary-foreground px-3 py-1",
            "hover:text-polkadot-500 font-light",
            "data-[state=on]:bg-accent data-[state=on]:text-accent-foreground data-[state=on]:font-bold",
            disabled && "opacity-50 pointer-events-none",
          )}
          disabled={disabled}
          style={{
            minWidth: btnWidth,
          }}
        >
          {content}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  )
}
