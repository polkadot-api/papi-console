import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { useNavigate } from "@/hashParams"
import { GitGraph } from "lucide-react"
import { ComponentType, FC, useEffect, useMemo, useRef, useState } from "react"
import { twMerge } from "tailwind-merge"

type CommandPaletteIcon = ComponentType<{ size?: number; className?: string }>

export type NavigationItem = {
  path: string
  label: string
  icon: CommandPaletteIcon
}

type CommandAction = {
  id: string
  path: string
  label: string
  description: string
  icon: CommandPaletteIcon
}

export const GlobalCommandPalette: FC<{
  navigationItems: NavigationItem[]
}> = ({ navigationItems }) => {
  const navigate = useNavigate()
  const [value, setValue] = useState("")
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const commandRef = useRef<HTMLDivElement>(null)
  const shortcutLabel = getCommandShortcutLabel()
  const { primaryActions, sectionActions } = useMemo(
    () => getCommandActions(value, navigationItems),
    [navigationItems, value],
  )

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setOpen(true)
        inputRef.current?.focus()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!commandRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener("pointerdown", handlePointerDown)
    return () => document.removeEventListener("pointerdown", handlePointerDown)
  }, [])

  const runAction = (action: CommandAction) => {
    navigate(action.path)
    setValue("")
    setOpen(false)
  }

  return (
    <div ref={commandRef} className="relative max-w-2xl flex-1">
      <Command
        shouldFilter={false}
        className={twMerge(
          "h-9 overflow-visible rounded-md border bg-input text-foreground shadow-none",
          "focus-within:ring-2 focus-within:ring-ring",
          "**:data-[slot=command-input-wrapper]:h-9 **:data-[slot=command-input-wrapper]:border-b-0",
          "**:data-[slot=command-input]:h-9 **:data-[slot=command-input]:py-0 **:data-[slot=command-input]:pr-16",
        )}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false)
            inputRef.current?.blur()
          }
        }}
      >
        <CommandInput
          ref={inputRef}
          value={value}
          onValueChange={(nextValue) => {
            setValue(nextValue)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder="Block hash, block number, or command"
          spellCheck={false}
          autoComplete="off"
        />
        <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border bg-background px-1.5 py-0.5 text-[10px] leading-none text-muted-foreground">
          {shortcutLabel}
        </kbd>
        {open ? (
          <div className="absolute left-0 top-[calc(100%+4px)] z-50 w-full min-w-80 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
            <CommandList className="max-h-96">
              <CommandEmpty>No matching command.</CommandEmpty>
              {primaryActions.length ? (
                <CommandGroup heading="Go to">
                  {primaryActions.map((action) => (
                    <CommandActionItem
                      key={action.id}
                      action={action}
                      onSelect={runAction}
                    />
                  ))}
                </CommandGroup>
              ) : null}
              <CommandGroup heading={value.trim() ? "Sections" : "Suggested"}>
                {sectionActions.map((action) => (
                  <CommandActionItem
                    key={action.id}
                    action={action}
                    onSelect={runAction}
                  />
                ))}
              </CommandGroup>
            </CommandList>
          </div>
        ) : null}
      </Command>
    </div>
  )
}

const CommandActionItem: FC<{
  action: CommandAction
  onSelect: (action: CommandAction) => void
}> = ({ action, onSelect }) => {
  const Icon = action.icon

  return (
    <CommandItem value={action.label} onSelect={() => onSelect(action)}>
      <Icon size={16} />
      <div className="min-w-0">
        <div className="truncate">{action.label}</div>
        <div className="truncate text-xs text-muted-foreground">
          {action.description}
        </div>
      </div>
    </CommandItem>
  )
}

const getCommandActions = (
  value: string,
  navigationItems: NavigationItem[],
) => {
  const query = value.trim()
  const primaryActions: CommandAction[] = []

  if (query.startsWith("/")) {
    primaryActions.push({
      id: `route:${query}`,
      path: query,
      label: `Open ${query}`,
      description: "Navigate to route",
      icon: GitGraph,
    })
  } else if (/^0x[0-9a-f]+$/i.test(query)) {
    primaryActions.push({
      id: `block-hash:${query}`,
      path: `/explorer/${query}`,
      label: "Open block hash",
      description: query,
      icon: GitGraph,
    })
  } else if (/^\d+$/.test(query)) {
    primaryActions.push({
      id: `block-number:${query}`,
      path: `/explorer/${query}`,
      label: `Open block ${Number(query).toLocaleString()}`,
      description: "Navigate by block number",
      icon: GitGraph,
    })
  }

  return {
    primaryActions,
    sectionActions: getSectionActions(query, navigationItems),
  }
}

const getSectionActions = (
  query: string,
  navigationItems: NavigationItem[],
): CommandAction[] => {
  const normalizedQuery = normalizeLabel(query)
  const items = !normalizedQuery
    ? navigationItems
    : [...navigationItems]
        .filter(({ label }) => normalizeLabel(label).includes(normalizedQuery))
        .sort((a, b) => {
          const aLabel = normalizeLabel(a.label)
          const bLabel = normalizeLabel(b.label)
          if (aLabel === normalizedQuery) return -1
          if (bLabel === normalizedQuery) return 1
          if (
            aLabel.startsWith(normalizedQuery) !==
            bLabel.startsWith(normalizedQuery)
          ) {
            return aLabel.startsWith(normalizedQuery) ? -1 : 1
          }
          return a.label.localeCompare(b.label)
        })

  return items.map((item) => ({
    id: `section:${item.path}`,
    path: item.path,
    label: item.label,
    description: "Open section",
    icon: item.icon,
  }))
}

const normalizeLabel = (value: string) =>
  value.toLowerCase().replace(/[\s_-]/g, "")

const getCommandShortcutLabel = () =>
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad|iPod/.test(navigator.platform)
    ? "⌘ K"
    : "Ctrl K"
