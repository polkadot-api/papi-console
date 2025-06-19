import { get, update } from "idb-keyval"
import { getDynamicBuilder, getLookupFn } from "@polkadot-api/metadata-builders"
import { getObservableClient } from "@polkadot-api/observable-client"
import {
  decAnyMetadata,
  HexString,
  unifyMetadata,
} from "@polkadot-api/substrate-bindings"
import { createClient as createSubstrateClient } from "@polkadot-api/substrate-client"
import { fromHex, toHex } from "@polkadot-api/utils"
import { sinkSuspense, state, SUSPENSE } from "@react-rxjs/core"
import { createSignal } from "@react-rxjs/utils"
import { createClient } from "polkadot-api"
import {
  catchError,
  concat,
  EMPTY,
  filter,
  finalize,
  firstValueFrom,
  from,
  map,
  NEVER,
  of,
  startWith,
  switchMap,
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
import {
  chopsticksInstance$,
  createChopsticksProvider,
} from "@/chopsticks/chopsticks"

export type ChainSource = WebsocketSource | SmoldotSource

export type SelectedChain = {
  network: Network
  endpoint: string
  withChopsticks: boolean
}
export const getChainSource = ({
  endpoint,
  network: { id, relayChain },
  withChopsticks,
}: SelectedChain) =>
  endpoint === "light-client"
    ? createSmoldotSource(id, relayChain)
    : createWebsocketSource(id, endpoint, withChopsticks)

const setRpcLogsEnabled = (enabled: boolean) =>
  localStorage.setItem("rpc-logs", String(enabled))
const getRpcLogsEnabled = () => localStorage.getItem("rpc-logs") === "true"
console.log("You can enable JSON-RPC logs by calling `setRpcLogsEnabled(true)`")
;(window as any).setRpcLogsEnabled = setRpcLogsEnabled

export const getProvider = (source: ChainSource) => {
  // TODO bug: provider is not getting disconnected
  chopsticksInstance$.next(null)

  const provider =
    source.type === "websocket"
      ? source.withChopsticks
        ? createChopsticksProvider(source.endpoint)
        : getWebsocketProvider(source)
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
  withChopsticks: false,
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
        withChopsticks: false,
      }
    }
    const network = findNetwork(networkId)
    if (network) return { network, endpoint, withChopsticks: false }
  }

  return defaultSelectedChain
}
export const selectedChain$ = state<SelectedChain>(
  selectedChainChanged$,
  getDefaultChain(),
)

const selectedSource$ = selectedChain$.pipe(switchMap(getChainSource))

// TODO: 2025-05-27
// remove old localStorage clear after a while
localStorage.removeItem("metadata-cache")

type MetadataCache = Map<string, { id: string; time: number; data: HexString }>
const IDB_KEY = "metadata-cache"
const MAX_CACHE_ENTRIES = 3

const addEntryToCache = (
  codeHash: string,
  entry: { id: string; time: number; data: HexString },
) =>
  update<MetadataCache>(IDB_KEY, (cached) => {
    cached ??= new Map()
    const old = [...cached.entries()].find(([, v]) => v.id === entry.id)
    if (old) cached.delete(old[0])
    cached.set(codeHash, entry)
    ;[...cached.entries()]
      .sort(([, a], [, b]) => b.time - a.time)
      .slice(MAX_CACHE_ENTRIES)
      .forEach(([k]) => {
        cached.delete(k)
      })
    return cached
  })

// TODO: ATM chopsticks hash is not implemented
// avoid cache in this situation
// remove `| null` when it is
const getMetadata = (codeHash: string | null) =>
  codeHash
    ? from(get<MetadataCache>(IDB_KEY)).pipe(
        map((cache) => {
          const entry = cache?.get(codeHash)
          if (!entry) return null
          addEntryToCache(codeHash, { ...entry, time: Date.now() })
          return fromHex(entry.data)
        }),
      )
    : of(null)

// TODO: ATM chopsticks hash is not implemented
// avoid cache in this situation
// remove `| null` when it is
const setMetadataFactory =
  (id: string) => (codeHash: string | null, data: Uint8Array) => {
    if (codeHash)
      addEntryToCache(codeHash, { id, time: Date.now(), data: toHex(data) })
  }

export const chainClient$ = state(
  selectedSource$.pipe(
    map((src) => [src.id, getProvider(src)] as const),
    switchMap(([id, provider], i) => {
      const setMetadata = setMetadataFactory(id)
      const substrateClient = createSubstrateClient(provider)
      const observableClient = getObservableClient(substrateClient, {
        getMetadata,
        setMetadata,
      })
      const chainHead = observableClient.chainHead$(2)
      const client = createClient(provider, {
        getMetadata: (id) => firstValueFrom(getMetadata(id)),
        setMetadata,
      })
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

export const canProduceBlocks$ = state(
  client$.pipe(
    switchMap((client) => client._request("rpc_methods", [])),
    map((response) => response.methods.includes("dev_newBlock")),
    catchError(() => [false]),
  ),
  false,
)

export const unsafeApi$ = chainClient$.pipeState(
  map(({ client }) => client.getUnsafeApi()),
)

const uncachedRuntimeCtx$ = chainClient$.pipeState(
  switchMap(({ chainHead }) => chainHead.runtime$),
  filter((v) => !!v),
)

export const runtimeCtx$ = chainClient$.pipeState(
  switchMap(({ id }) =>
    get<MetadataCache>(IDB_KEY).then((cache) =>
      cache ? [...cache.entries()].find(([, v]) => v.id === id) : undefined,
    ),
  ),
  switchMap((cached) => {
    if (cached) {
      const metadata = unifyMetadata(decAnyMetadata(cached[1].data))
      const lookup = getLookupFn(metadata)
      const dynamicBuilder = getDynamicBuilder(lookup)

      return uncachedRuntimeCtx$.pipe(
        startWith({
          lookup,
          dynamicBuilder,
        }),
      )
    }
    return uncachedRuntimeCtx$
  }),
)

export const lookup$ = runtimeCtx$.pipeState(map((ctx) => ctx.lookup))
export const metadata$ = lookup$.pipeState(map((lookup) => lookup.metadata))
export const dynamicBuilder$ = runtimeCtx$.pipeState(
  map((ctx) => ctx.dynamicBuilder),
)

export { networkCategories, type Network } from "./networks"
