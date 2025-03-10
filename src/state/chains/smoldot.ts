import { JsonRpcProvider } from "@polkadot-api/substrate-client"
import { getSmProvider } from "polkadot-api/sm-provider"
import { Chain } from "polkadot-api/smoldot"
import { startFromWorker } from "polkadot-api/smoldot/from-worker"
import SmWorker from "polkadot-api/smoldot/worker?worker"

const [dotChainSpec, ksmChainSpec, paseoChainSpec, westendChainSpec] = [
  import("polkadot-api/chains/polkadot"),
  import("polkadot-api/chains/ksmcc3"),
  import("polkadot-api/chains/paseo"),
  import("polkadot-api/chains/westend2"),
].map((x) => x.then((y) => y.chainSpec))
const smoldot = startFromWorker(new SmWorker(), {
  logCallback: (level, target, message) => {
    const lvl: keyof typeof console =
      level <= 1 ? "error" : level == 2 ? "warn" : "debug"
    if (import.meta.env.DEV || level <= 2) {
      console[lvl]("smoldot[%s(%s)] %s", target, level, message)
    }
  },
  forbidWs: true,
})
const relayChains: Record<
  string,
  { chainSpec: Promise<string>; chain: Promise<Chain> | null }
> = {
  polkadot: { chainSpec: dotChainSpec, chain: null },
  kusama: { chainSpec: ksmChainSpec, chain: null },
  paseo: { chainSpec: paseoChainSpec, chain: null },
  westend: { chainSpec: westendChainSpec, chain: null },
}
const getRelayChain = async (name: string) => {
  if (!relayChains[name].chain) {
    relayChains[name].chain = smoldot.addChain({
      chainSpec: await relayChains[name].chainSpec,
    })
  }
  return relayChains[name].chain
}

export interface SmoldotSource {
  type: "chainSpec"
  id: string
  value: {
    chainSpec: string
    relayChain?: string
  }
}

export function createSmoldotSource(
  id: string,
  relayChain?: string,
): Promise<SmoldotSource> {
  if (id in relayChains) {
    return relayChains[id].chainSpec.then((chainSpec) => ({
      id,
      type: "chainSpec",
      value: { chainSpec },
    }))
  }
  return import(`./chainspecs/${id}.ts`).then(({ chainSpec }) => {
    const parsed = JSON.parse(chainSpec)
    return {
      id,
      type: "chainSpec",
      value: {
        chainSpec,
        relayChain: relayChain || parsed.relayChain || parsed.relay_chain,
      },
    }
  })
}

export function getSmoldotProvider(source: SmoldotSource): JsonRpcProvider {
  const chain = source.value.relayChain
    ? getRelayChain(source.value.relayChain).then((chain) =>
        smoldot.addChain({
          chainSpec: source.value.chainSpec,
          potentialRelayChains: [chain],
        }),
      )
    : smoldot.addChain({
        chainSpec: source.value.chainSpec,
      })

  return getSmProvider(chain)
}
