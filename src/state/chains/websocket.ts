import type { JsonRpcProvider } from "polkadot-api"
import { getWsProvider } from "polkadot-api/ws"

export interface WebsocketSource {
  type: "websocket"
  id: string
  endpoint: string
  withChopsticks: boolean
}

export async function createWebsocketSource(
  id: string,
  endpoint: string,
  withChopsticks: boolean,
): Promise<WebsocketSource> {
  return { type: "websocket", id, endpoint, withChopsticks }
}

export function getWebsocketProvider(source: WebsocketSource): JsonRpcProvider {
  return getWsProvider(source.endpoint)
}
