import { cn } from "@/utils/cn"
import { Check, ChevronsUpDown } from "lucide-react"
import React, { useState } from "react"
import { Button } from "./ui/button"
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover"
import { twMerge } from "tailwind-merge"

export const SearchableSelect = <T,>({
  value,
  setValue,
  options,
  className,
  contentClassName,
  allowCustomValue,
}: {
  value: T | null
  setValue: (val: T | null) => void
  options: { value: T; text: string }[]
  className?: string
  contentClassName?: string
  // only for T=string
  allowCustomValue?: boolean
}) => {
  const [open, setOpen] = useState(false)
  const [filterValue, setFilterValue] = useState("")

  const onTriggerKeyDown = (evt: React.KeyboardEvent) => {
    if (evt.key.length === 1) {
      setOpen(true)
    }
  }

  const lowerCaseFilter = filterValue.toLocaleLowerCase()
  const hasExactMatch = options.some((v) => v.value === filterValue)
  const filteredOptions = allowCustomValue
    ? [
        ...options
          .filter(({ text }) =>
            text.toLocaleLowerCase().includes(lowerCaseFilter),
          )
          .sort((a, b) => {
            const aLowerCase = a.text.toLocaleLowerCase()
            if (aLowerCase === lowerCaseFilter) return -1
            const bLowerCase = b.text.toLocaleLowerCase()
            if (bLowerCase === lowerCaseFilter) return 1

            const aScore = aLowerCase.startsWith(lowerCaseFilter) ? 1 : 0
            const bScore = bLowerCase.startsWith(lowerCaseFilter) ? 1 : 0
            if (aScore != bScore) {
              return bScore - aScore
            }
            return aLowerCase.localeCompare(bLowerCase)
          }),
        ...(hasExactMatch || !filterValue
          ? []
          : [
              {
                value: filterValue as T,
                text: filterValue,
              },
            ]),
      ]
    : options

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild onKeyDown={onTriggerKeyDown}>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={twMerge(
            "flex w-52 justify-between overflow-hidden bg-input border border-border",
            className,
          )}
        >
          {value ? (
            <span className="text-ellipsis overflow-hidden">
              {options.find((option) => option.value === value)?.text ??
                (allowCustomValue ? filterValue : null)}
            </span>
          ) : (
            <span className="opacity-80">Select…</span>
          )}
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={twMerge("w-[200px] p-0", contentClassName)}>
        <Command shouldFilter={!allowCustomValue}>
          <CommandInput placeholder="Filter…" onValueChange={setFilterValue} />
          <CommandList>
            <CommandGroup>
              {filteredOptions.map((option, i) => (
                <CommandItem
                  key={i}
                  value={option.text}
                  onSelect={() => {
                    setValue(option.value)
                    setOpen(false)
                  }}
                >
                  {option.text}
                  <Check
                    className={cn(
                      "ml-auto",
                      value === option.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
