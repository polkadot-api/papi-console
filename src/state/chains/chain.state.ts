import { getDynamicBuilder, getLookupFn } from "@polkadot-api/metadata-builders"
import { getObservableClient } from "@polkadot-api/observable-client"
import { decAnyMetadata, HexString } from "@polkadot-api/substrate-bindings"
import { createClient as createSubstrateClient } from "@polkadot-api/substrate-client"
import { toHex } from "@polkadot-api/utils"
import { sinkSuspense, state, SUSPENSE } from "@react-rxjs/core"
import { createSignal } from "@react-rxjs/utils"
import { createClient } from "polkadot-api"
import {
  concat,
  EMPTY,
  filter,
  finalize,
  map,
  NEVER,
  of,
  startWith,
  switchMap,
  tap,
} from "rxjs"
import {
  addCustomNetwork,
  defaultNetwork,
  getCustomNetwork,
  Network,
  networkCategories,
} from "./networks"
import {
  createSmoldotSource,
  getSmoldotProvider,
  SmoldotSource,
} from "./smoldot"
import {
  createWebsocketSource,
  getWebsocketProvider,
  WebsocketSource,
} from "./websocket"
import { getHashParams, setHashParams } from "@/hashParams"
import { withLogsRecorder } from "polkadot-api/logs-provider"

export type ChainSource = WebsocketSource | SmoldotSource

export type SelectedChain = {
  network: Network
  endpoint: string
}
export const getChainSource = ({
  endpoint,
  network: { id, relayChain },
}: SelectedChain) =>
  endpoint === "light-client"
    ? createSmoldotSource(id, relayChain)
    : createWebsocketSource(id, endpoint)

const setRpcLogsEnabled = (enabled: boolean) =>
  localStorage.setItem("rpc-logs", String(enabled))
const getRpcLogsEnabled = () => localStorage.getItem("rpc-logs") === "true"
console.log("You can enable JSON-RPC logs by calling `setRpcLogsEnabled(true)`")
;(window as any).setRpcLogsEnabled = setRpcLogsEnabled

export const getProvider = (source: ChainSource) => {
  const provider =
    source.type === "websocket"
      ? getWebsocketProvider(source)
      : getSmoldotProvider(source)

  return withLogsRecorder((msg) => {
    if (import.meta.env.DEV || getRpcLogsEnabled()) {
      console.debug(msg)
    }
  }, provider)
}

export const [selectedChainChanged$, onChangeChain] =
  createSignal<SelectedChain>()
selectedChainChanged$.subscribe(({ network, endpoint }) =>
  setHashParams({
    networkId: network.id,
    endpoint,
  }),
)

const allNetworks = networkCategories.map((x) => x.networks).flat()
const findNetwork = (networkId: string): Network | undefined =>
  allNetworks.find((x) => x.id == networkId)

export const isValidUri = (input: string): boolean => {
  try {
    new URL(input)
  } catch {
    return false
  }
  return true
}

const defaultSelectedChain: SelectedChain = {
  network: defaultNetwork,
  endpoint: "light-client",
}
const getDefaultChain = (): SelectedChain => {
  const hashParams = getHashParams()
  if (hashParams.has("networkId") && hashParams.has("endpoint")) {
    const networkId = hashParams.get("networkId")!
    const endpoint = hashParams.get("endpoint")!
    if (networkId === "custom") {
      if (!isValidUri(endpoint)) return defaultSelectedChain
      addCustomNetwork(endpoint)
      return {
        network: getCustomNetwork(),
        endpoint,
      }
    }
    const network = findNetwork(networkId)
    if (network) return { network, endpoint }
  }

  return defaultSelectedChain
}
export const selectedChain$ = state<SelectedChain>(
  selectedChainChanged$,
  getDefaultChain(),
)

const selectedSource$ = selectedChain$.pipe(switchMap(getChainSource))

export const chainClient$ = state(
  selectedSource$.pipe(
    map((src) => [src.id, getProvider(src)] as const),
    switchMap(([id, provider], i) => {
      const substrateClient = createSubstrateClient(provider)
      const observableClient = getObservableClient(substrateClient)
      const chainHead = observableClient.chainHead$(2)
      const client = createClient(provider)
      return concat(
        i === 0 ? EMPTY : of(SUSPENSE),
        of({ id, client, substrateClient, observableClient, chainHead }),
        NEVER,
      ).pipe(
        finalize(() => {
          chainHead.unfollow()
          client.destroy()
          observableClient.destroy()
        }),
      )
    }),
    sinkSuspense(),
  ),
)
export const client$ = state(chainClient$.pipe(map(({ client }) => client)))

export const unsafeApi$ = chainClient$.pipeState(
  map(({ client }) => client.getUnsafeApi()),
)

const uncachedRuntimeCtx$ = chainClient$.pipeState(
  switchMap(({ chainHead }) => chainHead.runtime$),
  filter((v) => !!v),
)

const getMetadataCache = () => {
  const cached = localStorage.getItem(`metadata-cache`)
  return new Map<string, { time: number; data: HexString }>(
    cached ? JSON.parse(cached) : [],
  )
}
const getCachedMetadata = (id: string) =>
  getMetadataCache().get(id)?.data ?? null
const setCachedMetadata = (id: string, data: HexString) => {
  const cached = getMetadataCache()
  cached.set(id, { time: Date.now(), data })
  if (cached.size > 3) {
    const oldest = [...cached.entries()].reduce((a, b) =>
      a[1].time < b[1].time ? a : b,
    )[0]
    cached.delete(oldest)
  }
  localStorage.setItem("metadata-cache", JSON.stringify([...cached.entries()]))
}
export const runtimeCtx$ = chainClient$.pipeState(
  switchMap(({ id }) => {
    const cached = getCachedMetadata(id)

    const realCtx$ = uncachedRuntimeCtx$.pipe(
      tap((v) => {
        setCachedMetadata(id, toHex(v.metadataRaw))
      }),
    )

    if (cached) {
      const metadata = decAnyMetadata(cached)
      const lookup = getLookupFn(metadata.metadata.value as any)
      const dynamicBuilder = getDynamicBuilder(lookup)

      return realCtx$.pipe(
        startWith({
          lookup,
          dynamicBuilder,
        }),
      )
    }
    return realCtx$
  }),
)

export const lookup$ = runtimeCtx$.pipeState(map((ctx) => ctx.lookup))
export const metadata$ = lookup$.pipeState(map((lookup) => lookup.metadata))
export const dynamicBuilder$ = runtimeCtx$.pipeState(
  map((ctx) => ctx.dynamicBuilder),
)

export { networkCategories, type Network } from "./networks"
