import ksmRawNetworks from "./kusama.json"
import paseoRawNetworks from "./paseo.json"
import polkadotRawNetworks from "./polkadot.json"
import westendRawNetworks from "./westend.json"

export type Network = {
  id: string
  display: string
  endpoints: Record<string, string>
  lightclient: boolean
  relayChain?: string
}

export type NetworkCategory = {
  name: string
  networks: Network[]
}

const [Polkadot, Kusama, Paseo, Westend] = (
  [
    polkadotRawNetworks,
    ksmRawNetworks,
    paseoRawNetworks,
    westendRawNetworks,
  ] as const
).map((n): Network[] =>
  n.map((x) => ({
    endpoints: x.rpcs as any,
    lightclient: x.hasChainSpecs,
    id: x.id,
    display: x.display,
    relayChain: x.relayChainInfo?.id,
  })),
)

const networks = {
  Polkadot,
  Kusama,
  Paseo,
  Westend,
  Custom: [
    {
      id: "custom",
      display: "Custom",
      lightclient: false,
      endpoints: {
        "ws://127.0.0.1:9944": "ws://127.0.0.1:9944",
      },
    } as Network,
  ],
}

export const networkCategories: NetworkCategory[] = Object.entries(
  networks,
).map(([name, networks]) => ({ name, networks }))

export const getCustomNetwork = () => networks.Custom[0]
export const addCustomNetwork = (uri: string) => {
  getCustomNetwork().endpoints[uri] = uri
}

export const defaultNetwork = Polkadot[0]
