import type { JsonRpcProvider } from "polkadot-api"
import { getSmProvider } from "polkadot-api/sm-provider"
import { startFromWorker } from "polkadot-api/smoldot/from-worker"
import SmWorker from "polkadot-api/smoldot/worker?worker"

const [dotChainSpec, ksmChainSpec, paseoChainSpec, westendChainSpec] = [
  import("polkadot-api/chains/polkadot"),
  import("polkadot-api/chains/kusama"),
  import("polkadot-api/chains/paseo"),
  import("polkadot-api/chains/westend"),
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

const relayChains: Record<string, Promise<string>> = {
  polkadot: dotChainSpec,
  kusama: ksmChainSpec,
  paseo: paseoChainSpec,
  westend: westendChainSpec,
}

export interface SmoldotSource {
  type: "chainSpec"
  id: string
  value: {
    chainSpec: string
    relayChain?: string
  }
}

export async function createSmoldotSource(
  id: string,
  relayChain?: string,
): Promise<SmoldotSource> {
  if (id in relayChains) {
    const chainSpec = await relayChains[id]
    return {
      id,
      type: "chainSpec",
      value: { chainSpec },
    }
  }
  const { chainSpec } = await import(`./chainspecs/${id}.ts`)
  const parsed = JSON.parse(chainSpec)
  return {
    id,
    type: "chainSpec",
    value: {
      chainSpec,
      relayChain: relayChain || parsed.relayChain || parsed.relay_chain,
    },
  }
}

export function getSmoldotProvider(source: SmoldotSource): JsonRpcProvider {
  const chainFactory = () =>
    source.value.relayChain
      ? relayChains[source.value.relayChain].then(async (chainSpec) =>
          smoldot.addChain({
            chainSpec: source.value.chainSpec,
            potentialRelayChains: [await smoldot.addChain({ chainSpec })],
          }),
        )
      : smoldot.addChain({ chainSpec: source.value.chainSpec })

  return getSmProvider(chainFactory)
}
