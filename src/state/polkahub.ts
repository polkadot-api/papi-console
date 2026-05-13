import { polkadot_people } from "@polkadot-api/descriptors"
import { liftSuspense, state, SUSPENSE, withDefault } from "@react-rxjs/core"
import { AccountId, HexString, SS58String } from "polkadot-api"
import {
  Account,
  createLedgerProvider,
  createMultisigProvider,
  multisigExternalSigner,
  createPjsWalletProvider,
  createPolkadotVaultProvider,
  createPolkaHub,
  createReadOnlyProvider,
  createSelectedAccountPlugin,
  createWalletConnectProvider,
  knownChains,
  Plugin,
  createProxyProvider,
} from "polkahub"
import {
  combineLatest,
  filter,
  firstValueFrom,
  map,
  pipe,
  startWith,
  switchMap,
} from "rxjs"
import { chainProperties$ } from "./chain-props.state"
import {
  canSetStorage$,
  client$,
  getChainSource,
  selectedChain$,
  unsafeApi$,
} from "./chains/chain.state"
import { identity$, isVerified } from "./identity.state"

const removeSuspense = <T>() =>
  pipe(
    liftSuspense<T>(),
    filter<T | SUSPENSE, T>((v): v is T => v !== SUSPENSE),
  )

const getNetworkInfo = () =>
  firstValueFrom(
    chainProperties$.pipe(
      removeSuspense(),
      filter((v) => v != null),
      map(({ tokenDecimals, tokenSymbol }) => ({
        decimals: tokenDecimals!,
        tokenSymbol: tokenSymbol!,
      })),
    ),
  )

const selectedAccountPlugin = createSelectedAccountPlugin()
const pjsWalletProvider = createPjsWalletProvider()
const polkadotVaultProvider = createPolkadotVaultProvider({
  getNetworkInfo,
})
const readOnlyProvider$ = canSetStorage$.pipe(
  liftSuspense(),
  filter((v) => v !== SUSPENSE),
  map((fakeSigner) =>
    createReadOnlyProvider({
      fakeSigner,
    }),
  ),
)
const ledgerAccountProvider = createLedgerProvider(async () => {
  const module = await import("@ledgerhq/hw-transport-webusb")
  return module.default.create()
}, getNetworkInfo)
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
const proxyProvider = createProxyProvider((address) =>
  firstValueFrom(
    unsafeApi$.pipe(
      switchMap(
        (api) => api.query.Proxy.Proxies.getValue(address) as Promise<any>,
      ),
      map(([v]) => v),
    ),
  ),
)
const multisigProvider$ = selectedChain$.pipe(
  switchMap(getChainSource),
  map((source) => {
    if (source.type === "websocket" && source.withChopsticks) {
      return null
    }

    if (
      source.type === "chainSpec" &&
      ![
        "polkadot",
        "westend",
        "kusama",
        "paseo",
        "polkadot_asset_hub",
        "westend_asset_hub",
        "kusama_asset_hub",
        "paseo_asset_hub",
      ].includes(source.id)
    ) {
      return null
    }

    const chain =
      source.type === "chainSpec" ? `sm-${source.id}` : `ws-${source.endpoint}`

    return createMultisigProvider(
      multisigExternalSigner(
        (info, callData) =>
          `https://multisig.usepapi.app/?chain=${chain}&calldata=${callData}&signatories=${info.signatories.join("_")}&threshold=${info.threshold}`,
      ),
    )
  }),
  startWith(null),
)

export const polkaHub = createPolkaHub(
  combineLatest([
    [selectedAccountPlugin],
    [pjsWalletProvider],
    [polkadotVaultProvider],
    readOnlyProvider$,
    [ledgerAccountProvider],
    [walletConnectProvider],
    [proxyProvider],
    multisigProvider$,
  ]).pipe(map((v: (Plugin<any> | null)[]) => v.filter((v) => v != null))),
  {
    getIdentity: (address) =>
      identity$(address).pipe(
        removeSuspense(),
        map((res) =>
          res
            ? {
                name: res.displayName,
                verified: isVerified(res) ?? false,
              }
            : null,
        ),
      ),
    getBalance: (address) =>
      client$.pipe(
        removeSuspense(),
        switchMap((client) =>
          combineLatest([
            chainProperties$,
            client
              .getTypedApi(polkadot_people)
              .query.System.Account.getValue(address),
          ]),
        ),
        map(([chainProps, balance]) => {
          if (chainProps?.tokenDecimals == null) return null

          return {
            value: balance.data.reserved + balance.data.free,
            decimals: chainProps.tokenDecimals,
            symbol: chainProps.tokenSymbol,
          }
        }),
      ),
    ss58Format: chainProperties$.pipe(
      removeSuspense(),
      map((v) => v?.ss58Format ?? 42),
    ),
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
  (addr: SS58String | HexString) =>
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
