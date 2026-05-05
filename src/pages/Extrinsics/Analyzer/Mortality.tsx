import { client$ } from "@/state/chains/chain.state"
import { polkadot_people } from "@polkadot-api/descriptors"
import { state, useStateObservable } from "@react-rxjs/core"
import { FC } from "react"
import { combineLatest, map, switchMap } from "rxjs"
import { selectedBlockHex$ } from "./selectedBlock"

const selectedBlockNumber$ = state(
  combineLatest([selectedBlockHex$, client$]).pipe(
    switchMap(([selectedBlock, client]) =>
      selectedBlock
        ? (client
            .getTypedApi(polkadot_people)
            .query.System.Number.getValue({
              at: selectedBlock,
            })
            .catch(() => null) as Promise<number | null>)
        : client.finalizedBlock$.pipe(map((block) => block.number)),
    ),
  ),
)

export const AnalyzeMortality: FC<{
  mortality: { type: string; value: number }
}> = ({ mortality }) => {
  const selectedBlockNumber = useStateObservable(selectedBlockNumber$)

  if (mortality.type === "Immortal") return null
  const parseResult = /^Mortal(\d+)$/.exec(mortality.type)
  if (parseResult === null) return null
  const first = BigInt(parseResult[1])
  const second = BigInt(mortality.value)
  // from polkadot-sdk primitives runtime generic era fn decode
  const encoded = first + (second << 8n)
  const period = Number(2n << (encoded % (1n << 4n)))
  const factor = period >> 12 || 1
  const phase = Number(encoded >> 4n) * factor

  // From fn birth
  const birthBlock = selectedBlockNumber
    ? Math.floor((Math.max(selectedBlockNumber, phase) - phase) / period) *
        period +
      phase
    : null

  const referencedBlocks = birthBlock
    ? new Array(5)
        .fill(0)
        .map((_, i) => (birthBlock - period * i).toLocaleString())
    : null

  return (
    <div>
      <b>Mortality:</b> period={period} phase={phase}{" "}
      {referencedBlocks ? (
        <>
          currentBlock={selectedBlockNumber?.toLocaleString()} nextPeriod=
          {(birthBlock! + period).toLocaleString()} oldPeriods=
          {referencedBlocks.join(" ")}
        </>
      ) : null}
    </div>
  )
}

export const analyzeMortality$ = selectedBlockNumber$
