import { AccountIdDisplay } from "@/components/AccountIdDisplay"
import { WalletConnect } from "@/components/Icons"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  accountsByExtension$,
  extensionAccounts$,
  selectedExtensions$,
} from "@/state/extension-accounts.state"
import {
  walletConnectAccounts$,
  walletConnectStatus$,
} from "@/state/walletconnect.state"
import { mapObject, toHex } from "@polkadot-api/utils"
import { state, useStateObservable } from "@react-rxjs/core"
import { createSignal } from "@react-rxjs/utils"
import { InjectedExtension, PolkadotSigner } from "polkadot-api/pjs-signer"
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

const Accounts: React.FC<{ extension: InjectedExtension }> = ({
  extension,
}) => {
  const accounts = useStateObservable(extensionAccounts$(extension.name))

  return (
    <SelectGroup>
      <SelectLabel>{extension.name}</SelectLabel>
      {accounts.map((account) => (
        <SelectItem
          key={account.address}
          value={account.address + "-" + extension.name}
        >
          <AccountIdDisplay value={account.address} />
        </SelectItem>
      ))}
    </SelectGroup>
  )
}

const WalletConnectAccounts = () => {
  const accounts = useStateObservable(walletConnectAccounts$)

  if (!Object.keys(accounts).length) return null

  return (
    <SelectGroup>
      <SelectLabel className="flex gap-1">
        <WalletConnect /> Wallet Connect
      </SelectLabel>
      {Object.keys(accounts).map((address) => (
        <SelectItem key={address} value={address + "-" + "wallet_connect"}>
          <AccountIdDisplay value={address} />
        </SelectItem>
      ))}
    </SelectGroup>
  )
}

const [valueSelected$, selectValue] = createSignal<string>()

const LS_KEY = "selected-signer"
const selectedValue$ = state(
  merge(
    defer(() => of(localStorage.getItem(LS_KEY))),
    valueSelected$.pipe(tap((v) => localStorage.setItem(LS_KEY, v))),
  ),
  null,
)

const withSignerLogs = (input: PolkadotSigner) => {
  const signTx: PolkadotSigner["signTx"] = (
    callData,
    signedExtensions,
    ...rest
  ) => {
    console.log("signing transaction...")
    console.log({
      publicKey: toHex(input.publicKey),
      callData: toHex(callData),
      signedExtensions: mapObject(
        signedExtensions,
        ({ identifier, value, additionalSigned }) => ({
          identifier,
          value: toHex(value),
          additionalSigned: toHex(additionalSigned),
        }),
      ),
    })

    return input.signTx(callData, signedExtensions, ...rest)
  }

  return { ...input, signTx }
}

export const selectedAccount$ = state(
  combineLatest([
    selectedValue$,
    accountsByExtension$,
    walletConnectAccounts$,
  ]).pipe(
    map(([selectedAccount, accountsByExtension, walletConnectAccounts]) => {
      if (!selectedAccount) return null
      const [address, ...rest] = selectedAccount.split("-")
      const signer = rest.join("-")

      if (signer === "wallet_connect") {
        return address in walletConnectAccounts
          ? {
              polkadotSigner: walletConnectAccounts[address],
            }
          : null
      }

      const accounts = accountsByExtension.get(signer)
      if (!accounts) return null
      return accounts.find((account) => account.address === address) ?? null
    }),
    distinctUntilChanged(),
    map((x) => {
      if (!x) return x
      x.polkadotSigner = withSignerLogs(x.polkadotSigner)
      return x
    }),
  ),
  null,
)

const allAccounts$ = state(
  combineLatest([walletConnectAccounts$, accountsByExtension$]).pipe(
    map(([wcAccounts, accounts]) => [
      ...Object.keys(wcAccounts).map((account) => `${account}-wallet_connect`),
      ...[...accounts.entries()].flatMap(([extension, accounts]) =>
        accounts.map((account) => `${account.address}-${extension}`),
      ),
    ]),
  ),
  [],
)

export const AccountProvider: React.FC = () => {
  const value = useStateObservable(selectedValue$)
  const extensions = useStateObservable(selectedExtensions$)
  const walletConnect = useStateObservable(walletConnectStatus$)
  const allAccounts = useStateObservable(allAccounts$)

  const activeExtensions = [...extensions.values()].filter((v) => !!v)
  const valueExists = value && allAccounts.includes(value)

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
        {activeExtensions.map((extension) => (
          <Accounts key={extension.name} extension={extension} />
        ))}
        <WalletConnectAccounts />
      </SelectContent>
    </Select>
  )
}
