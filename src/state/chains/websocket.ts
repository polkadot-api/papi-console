import { getWsProvider, StatusChange, WsJsonRpcProvider } from "polkadot-api/ws"
import { Observable, Subject } from "rxjs"

export interface WebsocketSource {
  type: "websocket"
  id: string
  endpoint: string | string[]
  forkMethod: "none" | "chopsticks" | "forklift"
}

export async function createWebsocketSource(
  id: string,
  endpoint: string | string[],
  forkMethod: WebsocketSource["forkMethod"],
): Promise<WebsocketSource> {
  return { type: "websocket", id, endpoint, forkMethod }
}

export type WsStatusJsonRpcProvider = WsJsonRpcProvider & {
  statusChange$: Observable<StatusChange>
}
export function getWebsocketProvider(
  source: WebsocketSource,
): WsStatusJsonRpcProvider {
  const statusChange$ = new Subject<StatusChange>()
  const provider = getWsProvider(source.endpoint, {
    onStatusChanged(status) {
      statusChange$.next(status)
    },
  })

  return Object.assign(provider, {
    statusChange$: statusChange$.asObservable(),
  })
}
