import { createLocalStorageState } from "@/lib/externalState"
import { state } from "@react-rxjs/core"
import type { HexString, PolkadotSigner, SS58String } from "polkadot-api"
import type { InjectedPolkadotAccount } from "polkadot-api/pjs-signer"
import { combineLatest, defer, from, map, switchMap } from "rxjs"
import { accountsByExtension$ } from "./extension-accounts.state"

export type AccountSource = "extension" | "walletconnect" | "readonly"
export const accountSourceTypeToName: Record<AccountSource, string> = {
  extension: "Extension",
  walletconnect: "Wallet Connect",
  readonly: "Read-only",
}

const lazyWalletConnectAccounts$ = defer(() =>
  from(import("@/state/walletconnect.state")).pipe(
    switchMap(({ walletConnectAccounts$ }) => walletConnectAccounts$),
  ),
)

interface BaseAccount {
  type: AccountSource
  accountId: SS58String | HexString
  name?: string
}

interface SignerAccount extends BaseAccount {
  signer: PolkadotSigner
}

export interface ExtensionAccount extends SignerAccount {
  type: "extension"
  extensionId: string
  injected: InjectedPolkadotAccount
}
export const extensionAccounts$ = state(
  accountsByExtension$.pipe(
    map((extensionAccounts) =>
      Array.from(extensionAccounts.entries()).flatMap(([extension, accounts]) =>
        accounts.map(
          (account): ExtensionAccount => ({
            type: "extension",
            accountId: account.address,
            name: account.name,
            extensionId: extension,
            injected: account,
            signer: account.polkadotSigner,
          }),
        ),
      ),
    ),
  ),
  [],
)

export interface WalletConnectAccount extends SignerAccount {
  type: "walletconnect"
}
export const walletConnectAccounts$ = state(
  lazyWalletConnectAccounts$.pipe(
    map((accounts) =>
      Object.entries(accounts).map(
        ([accountId, signer]): WalletConnectAccount => ({
          type: "walletconnect",
          accountId,
          signer,
        }),
      ),
    ),
  ),
  [],
)

export interface ReadOnlyAccount extends BaseAccount {
  type: "readonly"
}
export const [readOnlyAddresses$, setAddresses] = createLocalStorageState(
  "read-only-addr",
  [] as string[],
)
export const readOnlyAccounts$ = readOnlyAddresses$.pipe(
  map((v) =>
    v.map(
      (address): ReadOnlyAccount => ({
        type: "readonly",
        accountId: address,
      }),
    ),
  ),
)

export type Account = ExtensionAccount | WalletConnectAccount | ReadOnlyAccount
export const accounts$ = state(
  combineLatest([
    extensionAccounts$,
    walletConnectAccounts$,
    readOnlyAccounts$,
  ]).pipe(map((v): Account[] => v.flat())),
  [],
)
