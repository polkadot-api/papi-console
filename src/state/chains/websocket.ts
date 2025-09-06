import { withPolkadotSdkCompat } from "polkadot-api/polkadot-sdk-compat"
import { getWsProvider, JsonRpcProvider } from "polkadot-api/ws-provider/web"

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
  return withPolkadotSdkCompat(getWsProvider(source.endpoint))
}
