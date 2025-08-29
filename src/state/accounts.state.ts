import { createLocalStorageState } from "@/lib/externalState"
import { state } from "@react-rxjs/core"
import type { HexString, PolkadotSigner, SS58String } from "polkadot-api"
import type { InjectedPolkadotAccount } from "polkadot-api/pjs-signer"
import { combineLatest, defer, from, map, switchMap } from "rxjs"
import { accountsByExtension$, getPublicKey } from "./extension-accounts.state"
import { getPolkadotSigner } from "polkadot-api/signer"
import { canSetStorage$ } from "./chains/chain.state"

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
  // Chopsticks can fake a signer
  signer?: PolkadotSigner
}
const [readOnlyAddresses$, setAddresses] = createLocalStorageState(
  "read-only-addr",
  [] as string[],
)
export { setAddresses }
export const readOnlyAccounts$ = state(
  combineLatest([defer(readOnlyAddresses$), canSetStorage$]).pipe(
    map(([v, isChopsticks]) =>
      v.map(
        (address): ReadOnlyAccount => ({
          type: "readonly",
          accountId: address,
          signer: isChopsticks
            ? getPolkadotSigner(getPublicKey(address)!, "Sr25519", () => {
                // From https://wiki.acala.network/build/sdks/homa
                const signature = new Uint8Array(64)
                signature.fill(0xcd)
                signature.set([0xde, 0xad, 0xbe, 0xef])
                return signature
              })
            : undefined,
        }),
      ),
    ),
  ),
  [],
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
