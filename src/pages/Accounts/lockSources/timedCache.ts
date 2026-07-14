import { DotAh } from "@polkadot-api/descriptors"
import { PolkadotClient, TypedApi } from "polkadot-api"

export const createTimedCache = <T>(
  fetchValue: (
    unsafeApi: TypedApi<DotAh, false>,
    client: PolkadotClient,
  ) => Promise<T>,
  timeout = 5 * 60 * 1000,
) => {
  const catxé = new WeakMap<
    PolkadotClient,
    {
      timestamp: number
      value: Promise<T>
    }
  >()

  return (client: PolkadotClient) => {
    const cached = catxé.get(client)
    if (cached && cached.timestamp > Date.now() - timeout) return cached.value
    const value = fetchValue(client.getUnsafeApi<DotAh>(), client)
    catxé.set(client, { timestamp: Date.now(), value })
    return value
  }
}
