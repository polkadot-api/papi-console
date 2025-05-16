import {
  JsonRpcConnection,
  JsonRpcProvider,
} from "@polkadot-api/substrate-client"
import {
  connectable,
  filter,
  firstValueFrom,
  Observable,
  Subject,
  Subscription,
} from "rxjs"
// import { Provider } from "@acala-network/chopsticks-core"

type ProviderInterfaceCallback = (error: Error | null, result: any) => void
type ProviderInterfaceEmitted = "connected" | "disconnected" | "error"
type ProviderInterfaceEmitCb = (value?: any) => any
interface ProviderInterface {
  /** true if the provider supports subscriptions (not available for HTTP) */
  readonly hasSubscriptions: boolean
  /** true if the clone() functionality is available on the provider */
  readonly isClonable: boolean
  /** true if the provider is currently connected (ws/sc has connection logic) */
  readonly isConnected: boolean
  clone(): ProviderInterface
  connect(): Promise<void>
  disconnect(): Promise<void>
  on(type: ProviderInterfaceEmitted, sub: ProviderInterfaceEmitCb): () => void
  send<T = any>(
    method: string,
    params: unknown[],
    isCacheable?: boolean,
  ): Promise<T>
  subscribe(
    type: string,
    method: string,
    params: unknown[],
    cb: ProviderInterfaceCallback,
  ): Promise<number | string>
  unsubscribe(
    type: string,
    method: string,
    id: number | string,
  ): Promise<boolean>
}

type JsonRpcResponse = {
  jsonrpc: "2.0"
  id: number
  result?: unknown
  error?: unknown
}
type JsonRpcRequest = {
  jsonrpc: "2.0"
  method: string
  params: unknown[]
  id?: number
}

export const chopsticksProviderInterfaceFromJsonRPC = (
  provider: JsonRpcProvider,
): ProviderInterface => {
  let connection: JsonRpcConnection | null = null
  const connectionEvt$ = new Subject<ProviderInterfaceEmitted>()
  const shared$ = connectable(
    new Observable<JsonRpcResponse>((obs) => {
      connection = provider((v) => obs.next(JSON.parse(v)))
      connectionEvt$.next("connected")

      return () => {
        connection?.disconnect()
        connection = null
        connectionEvt$.next("disconnected")
      }
    }),
  )
  let topSubscription: Subscription | null = null

  let nextId = 0

  return {
    hasSubscriptions: true,
    isClonable: false,
    get isConnected() {
      return !!connection
    },
    clone() {
      throw new Error("Not clonable")
    },
    async connect() {
      if (connection) return
      topSubscription = shared$.connect()
    },
    async disconnect() {
      topSubscription?.unsubscribe()
    },
    on(type, cb) {
      const sub = connectionEvt$.pipe(filter((v) => v === type)).subscribe(cb)
      return () => sub.unsubscribe()
    },
    async send<T>(method: string, params: unknown[]) {
      const id = nextId++
      const responsePromise = firstValueFrom(
        shared$.pipe(filter((v) => v.id === id)),
      )

      connection?.send(
        JSON.stringify({
          jsonrpc: "2.0",
          method,
          params,
          id,
        } satisfies JsonRpcRequest),
      )

      const response = await responsePromise
      if (response.result) return response.result as T
      throw response.error
    },
  }
}
