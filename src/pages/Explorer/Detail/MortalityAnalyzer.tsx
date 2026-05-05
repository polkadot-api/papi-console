import { client$ } from "@/state/chains/chain.state"
import { useStateObservable, withDefault } from "@react-rxjs/core"
import { FC, useContext } from "react"
import { map, switchMap } from "rxjs"
import { BlockContext } from "./blockContext"

const finalizedNumber$ = client$.pipeState(
  switchMap((v) => v.finalizedBlock$),
  map((block) => block.number),
  withDefault(null),
)

export const MortalityAnalyzer: FC<{
  mortality: { type: string; value: number }
}> = ({ mortality }) => {
  const selectedBlock = useContext(BlockContext)
  const finalizedNumber = useStateObservable(finalizedNumber$)
  const selectedBlockNumber = selectedBlock?.number ?? finalizedNumber

  if (mortality.type === "Immortal") return <div>Immortal</div>
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

  return (
    <div>
      period={period} phase={phase}{" "}
      {birthBlock != null
        ? `currentBlock=${selectedBlockNumber?.toLocaleString()} from=${birthBlock.toLocaleString()} to=${(birthBlock + period).toLocaleString()}`
        : null}
    </div>
  )
}
