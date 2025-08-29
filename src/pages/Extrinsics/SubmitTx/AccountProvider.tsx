import { AccountIdDisplay } from "@/components/AccountIdDisplay"
import { EthAccountDisplay } from "@/components/EthAccountDisplay"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { groupBy } from "@/lib/groupBy"
import { knownExtensions } from "@/pages/Accounts/Providers"
import {
  Account,
  accounts$,
  AccountSource,
  accountSourceTypeToName,
} from "@/state/accounts.state"
import { selectedExtensions$ } from "@/state/extension-accounts.state"
import { walletConnectStatus$ } from "@/state/walletconnect.state"
import { state, useStateObservable, withDefault } from "@react-rxjs/core"
import { createSignal } from "@react-rxjs/utils"
import React from "react"
import {
  combineLatest,
  defer,
  distinctUntilChanged,
  map,
  merge,
  of,
  tap,
} from "rxjs"

const [valueSelected$, selectValue] = createSignal<string>()

const LS_KEY = "selected-signer"
const selectedValue$ = state(
  merge(
    defer(() => of(localStorage.getItem(LS_KEY))),
    valueSelected$.pipe(tap((v) => localStorage.setItem(LS_KEY, v))),
  ),
  null,
)

const allAccounts$ = accounts$.pipeState(
  map((v) =>
    v.map((acc) => ({
      ...acc,
      id: `${acc.accountId}-${acc.type === "extension" ? acc.extensionId : acc.type}`,
    })),
  ),
  withDefault([]),
)

export const selectedAccount$ = state(
  combineLatest([selectedValue$, allAccounts$]).pipe(
    map(([selectedAccount, accounts]): Account | null => {
      if (!selectedAccount) return null
      const account = accounts.find((account) => account.id === selectedAccount)

      return account ?? null
    }),
    distinctUntilChanged(),
  ),
  null,
)

const groupedAccounts$ = allAccounts$.pipeState(
  map((v) =>
    groupBy(
      // Accept only signer accounts for submitting transactions
      v.filter((v) => "signer" in v),
      (acc) => (acc.type === "extension" ? acc.extensionId : acc.type),
    ),
  ),
)

const groupIdToName = (groupId: string) => {
  if (groupId in knownExtensions) {
    return knownExtensions[groupId].name
  }
  return accountSourceTypeToName[groupId as AccountSource] ?? groupId
}

export const AccountProvider: React.FC = () => {
  const value = useStateObservable(selectedValue$)
  const extensions = useStateObservable(selectedExtensions$)
  const walletConnect = useStateObservable(walletConnectStatus$)
  const allAccounts = useStateObservable(allAccounts$)
  const groupedAccounts = useStateObservable(groupedAccounts$)

  const activeExtensions = [...extensions.values()].filter((v) => !!v)
  const valueExists = value && allAccounts.some((acc) => acc.id === value)

  if (!activeExtensions.length && walletConnect.type !== "connected")
    return null

  return (
    <Select
      value={valueExists ? (value ?? "") : ""}
      onValueChange={selectValue}
    >
      <SelectTrigger className="h-auto border-foreground/30">
        <SelectValue placeholder="Select an account" />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(groupedAccounts).map(([groupId, accounts]) => (
          <SelectGroup key={groupId}>
            <SelectLabel className="flex gap-1">
              {groupIdToName(groupId)}
            </SelectLabel>
            {accounts.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                {account.accountId.startsWith("0x") ? (
                  <EthAccountDisplay value={account.accountId} />
                ) : (
                  <AccountIdDisplay value={account.accountId} />
                )}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  )
}
