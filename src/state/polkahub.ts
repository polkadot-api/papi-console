import { polkadot_people } from "@polkadot-api/descriptors"
import { state, withDefault } from "@react-rxjs/core"
import { AccountId, SS58String } from "polkadot-api"
import {
  Account,
  createLedgerProvider,
  createPjsWalletProvider,
  createPolkadotVaultProvider,
  createPolkaHub,
  createReadOnlyProvider,
  createSelectedAccountPlugin,
  createWalletConnectProvider,
  knownChains,
  Plugin,
} from "polkahub"
import { combineLatest, filter, firstValueFrom, map } from "rxjs"
import { chainProperties$ } from "./chain-props.state"
import { canSetStorage$, client$ } from "./chains/chain.state"
import { getAddressName, isVerified } from "./identity.state"

const selectedAccountPlugin = createSelectedAccountPlugin()
const pjsWalletProvider = createPjsWalletProvider()
const polkadotVaultProvider = createPolkadotVaultProvider()
const readOnlyProvider$ = canSetStorage$.pipe(
  map((fakeSigner) =>
    createReadOnlyProvider({
      fakeSigner,
    }),
  ),
)
const ledgerAccountProvider = createLedgerProvider(
  async () => {
    const module = await import("@ledgerhq/hw-transport-webhid")
    return module.default.create()
  },
  () =>
    firstValueFrom(
      chainProperties$.pipe(
        filter((v) => v != null),
        map(({ ss58Format, tokenDecimals, tokenSymbol }) => ({
          decimals: tokenDecimals!,
          tokenSymbol: tokenSymbol!,
          ss58Format: ss58Format!,
        })),
      ),
    ),
)
const walletConnectProvider = createWalletConnectProvider(
  import.meta.env.VITE_REOWN_PROJECT_ID,
  [
    knownChains.polkadot,
    knownChains.polkadotAh,
    knownChains.kusama,
    knownChains.kusamaAh,
    knownChains.paseo,
    knownChains.paseoAh,
  ],
)

export const polkaHub = createPolkaHub(
  combineLatest([
    [selectedAccountPlugin],
    [pjsWalletProvider],
    [polkadotVaultProvider],
    readOnlyProvider$,
    [ledgerAccountProvider],
    [walletConnectProvider],
  ]).pipe(map((v: (Plugin<any> | null)[]) => v.filter((v) => v != null))),
  {
    async getIdentity(address) {
      const res = await getAddressName(address)
      return res
        ? {
            name: res.displayName,
            verified: isVerified(res) ?? false,
          }
        : null
    },
    async getBalance(address) {
      const client = await firstValueFrom(client$)
      const [chainProps, balance] = await firstValueFrom(
        combineLatest([
          chainProperties$,
          client
            .getTypedApi(polkadot_people)
            .query.System.Account.getValue(address),
        ]),
      )

      if (chainProps?.tokenDecimals == null) return null

      return {
        value: balance.data.reserved + balance.data.free,
        decimals: chainProps.tokenDecimals,
        symbol: chainProps.tokenSymbol,
      }
    },
  },
)

export const addrToAccount$ = polkaHub.availableAccounts$.pipeState(
  map((groups) =>
    Object.fromEntries(
      Object.values(groups).flatMap((group) =>
        group.map((account) => [account.address, account]),
      ),
    ),
  ),
  withDefault({} as Record<string, Account>),
)

export const accountDetail$ = state(
  (addr: SS58String) =>
    addrToAccount$.pipe(map((addrToAccount) => addrToAccount[addr] ?? null)),
  null,
)

export const getPublicKey = AccountId().enc

export const selectedAccount$ =
  selectedAccountPlugin.selectedAccount$.pipeState(withDefault(null))

export const availableExtensions$ = pjsWalletProvider.availableExtensions$
export const selectedExtensions$ = pjsWalletProvider.connectedExtensions$
export const toggleExtension = async (id: string) => {
  const extensions = await firstValueFrom(
    pjsWalletProvider.connectedExtensions$,
  )
  pjsWalletProvider.setConnectedExtensions(
    extensions.includes(id)
      ? extensions.filter((v) => v != id)
      : [...extensions, id],
  )
}
