import { EthAccountDisplay } from "@/components/EthAccountDisplay"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { accountDetail$, accounts$ } from "@/state/extension-accounts.state"
import { cn } from "@/utils/cn"
import { EditEthAccount, NOTIN } from "@polkadot-api/react-builder"
import { ethAccount, HexString } from "@polkadot-api/substrate-bindings"
import { state, useStateObservable } from "@react-rxjs/core"
import { combineKeys } from "@react-rxjs/utils"
import { Check, ChevronsUpDown } from "lucide-react"
import { FC, useMemo, useState } from "react"
import { map, take } from "rxjs"

const hintedAccounts$ = state(
  combineKeys(
    accounts$.pipe(
      map((accounts) =>
        [...accounts.entries()]
          .filter(([, { address }]) => address.startsWith("0x"))
          .map(([key]) => key),
      ),
    ),
    (account) =>
      accounts$.pipe(
        map((v) => {
          const details = v.get(account)!
          return {
            address: details.address,
            name: details.name,
          }
        }),
        take(1),
      ),
  ).pipe(
    map(
      (v) => new Map([...v].map(([key, value]) => [key.toLowerCase(), value])),
    ),
  ),
  new Map<
    string,
    {
      address: string
      name: string | undefined
    }
  >(),
)

const isEthAddressValid = (address: HexString) => {
  try {
    ethAccount.dec(address)
  } catch {
    return false
  }
  return true
}

export const CEthAccount: EditEthAccount = ({ value, onValueChanged }) => {
  const accounts = useStateObservable(hintedAccounts$)

  const [query, setQuery] = useState("")
  const isValid = useMemo(() => isEthAddressValid(query), [query])

  const [open, _setOpen] = useState(false)
  const setOpen = (value: boolean) => {
    _setOpen(value)
    setQuery("")
  }

  const valueIsNew =
    value !== NOTIN &&
    !accounts.has(isEthAddressValid(value) ? value.toLowerCase() : "")

  const accountList = Array.from(accounts.entries())
  if (value !== NOTIN) {
    accountList.sort(([a], [b]) =>
      a === b ? -1 : b === value.toLowerCase() ? 1 : 0,
    )
  }

  const onTriggerKeyDown = (evt: React.KeyboardEvent) => {
    if (evt.key.length === 1) {
      setOpen(true)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild onKeyDown={onTriggerKeyDown}>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="flex w-64 justify-between overflow-hidden px-2 border border-border bg-input"
          forceSvgSize={false}
        >
          {value !== NOTIN ? (
            <EthAccountDisplay value={value} className="overflow-hidden" />
          ) : (
            <span className="opacity-80">Select…</span>
          )}
          <ChevronsUpDown size={14} className="opacity-50 flex-shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0">
        <Command>
          <CommandInput
            placeholder="Filter…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>
              <div className="text-foreground/50">
                The value is not a valid Ethereum Address
              </div>
            </CommandEmpty>
            <CommandGroup>
              {valueIsNew && (
                <AccountOption
                  account={value}
                  selected={true}
                  onSelect={() => setOpen(false)}
                />
              )}
              {accountList.map(([key, account]) => (
                <AccountOption
                  key={key}
                  account={account.address}
                  selected={value === account.address}
                  onSelect={() => {
                    onValueChanged(account.address)
                    setOpen(false)
                  }}
                />
              ))}
              {isValid && (
                <AccountOption
                  account={query}
                  selected={value === query}
                  onSelect={() => {
                    onValueChanged(query)
                    setOpen(false)
                  }}
                />
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

const AccountOption: FC<{
  account: string
  selected: boolean
  onSelect: () => void
}> = ({ account, selected, onSelect }) => {
  const details = useStateObservable(accountDetail$(account))

  const name = details?.name

  return (
    <CommandItem
      value={account + "_" + name}
      onSelect={onSelect}
      className="flex flex-row items-center gap-2 p-1"
      forceSvgSize={false}
    >
      <EthAccountDisplay value={account} className="overflow-hidden" />
      <Check
        size={12}
        className={cn(
          "ml-auto flex-shrink-0",
          selected ? "opacity-100" : "opacity-0",
        )}
      />
    </CommandItem>
  )
}
