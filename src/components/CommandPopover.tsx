import * as React from "react"
import { Command, CommandInput } from "./ui/command"
import { useEffect } from "react"

type CommandPopoverProps = React.PropsWithChildren<{
  placeholder?: string
  value?: string
  selectedValue?: unknown
  onValueChange?: (value: string) => void
}>

export function CommandPopover({
  placeholder,
  value,
  onValueChange,
  selectedValue,
  children,
}: CommandPopoverProps) {
  const [open, setOpen] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const commandRef = React.useRef<HTMLDivElement>(null)

  const handleInputChange = (value: string) => {
    onValueChange?.(value)
    if (!open) setOpen(true)
  }

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        commandRef.current &&
        !commandRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  useEffect(() => {
    setOpen(false)
    onValueChange?.("")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedValue])

  // Handle keyboard events for showing/hiding the command menu
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Show the command menu on arrow down when it's closed
    if (e.key === "ArrowDown" && !open) {
      e.preventDefault()
      setOpen(true)
    }

    // Hide the command menu on escape
    if (e.key === "Escape" && open) {
      e.preventDefault()
      setOpen(false)
    }
  }

  return (
    <div className="relative w-full">
      <Command
        className="rounded-lg border shadow-md overflow-visible bg-transparent"
        onKeyDown={handleKeyDown}
      >
        <CommandInput
          ref={inputRef}
          value={value}
          onValueChange={handleInputChange}
          onClick={() => setOpen(true)}
          placeholder={placeholder}
          className="border-none focus:ring-0"
          autoFocus
        />

        {open && (
          <div
            ref={commandRef}
            className="absolute w-full top-[calc(100%+4px)] left-0 rounded-lg border bg-popover shadow-md z-50"
          >
            {children}
          </div>
        )}
      </Command>
    </div>
  )
}
