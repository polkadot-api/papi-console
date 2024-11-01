import { lookup$ } from "@/chain.state"
import { groupBy } from "@/lib/groupBy"
import { getDynamicBuilder } from "@polkadot-api/metadata-builders"
import { state, useStateObservable } from "@react-rxjs/core"
import { FC, ReactNode } from "react"
import { map } from "rxjs"
import { blockInfo$, BlockState } from "./block.state"
import { filterEvt } from "./Events"
import { CircularProgress } from "@/components/CircularProgress"
import { CircleAlert, CircleCheck, CircleX, Clock } from "lucide-react"

const blockInfoState$ = state((hash: string) => blockInfo$(hash), null)
const maxBlockWeight$ = state(
  lookup$.pipe(
    map((lookup) => {
      const ct = lookup.metadata.pallets
        .find((p) => p.name === "System")
        ?.constants.find((ct) => ct.name === "BlockWeights")
      if (!ct) return null
      return getDynamicBuilder(lookup).buildDefinition(ct.type).dec(ct.value)
        .max_block as Weight
    }),
  ),
  null,
)
export const BlockPopover: FC<{ hash: string }> = ({ hash }) => {
  const block = useStateObservable(blockInfoState$(hash))
  if (!block) return null

  const eventGroups = block.events
    ? groupBy(block.events, (evt) => evt.phase.type)
    : null
  const filteredEvents =
    eventGroups?.["ApplyExtrinsic"]?.filter(filterEvt).length ?? 0

  const extrinsicEvents = block.events?.filter(
    (evt) =>
      evt.event.type === "System" &&
      ["ExtrinsicFailed", "ExtrinsicSuccess"].includes(evt.event.value.type),
  )
  const weight =
    extrinsicEvents
      ?.map(
        (evt) =>
          (evt.event.value.value.dispatch_info?.weight ??
            null) as Weight | null,
      )
      .reduce(addWeight, {
        proof_size: 0n,
        ref_time: 0n,
      }) ?? null

  return (
    <div>
      <h3 className="font-bold text-lg">
        Block{" "}
        <span className="font-mono text-sm font-normal text-slate-200">
          {hash}
        </span>
      </h3>
      <p>Status: {statusRep[block.status]}</p>
      <div className="flex justify-between items-start">
        {eventGroups && (
          <div>
            <h3 className="font-bold">Events</h3>
            <table>
              <tbody>
                <tr>
                  <td>Initialization</td>
                  <td className="px-2">
                    {eventGroups["Initialization"]?.length ?? 0}
                  </td>
                </tr>
                <tr>
                  <td>Extrinsic</td>
                  <td className="px-2">
                    {filteredEvents}/
                    {eventGroups["ApplyExtrinsic"]?.length ?? 0}
                    <span className="text-slate-300"> (filtered/total)</span>
                  </td>
                </tr>
                <tr>
                  <td>Finalization</td>
                  <td className="px-2">
                    {eventGroups["Finalization"]?.length ?? 0}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
        <WeightLimits weight={weight} />
      </div>
    </div>
  )
}

const WeightLimits: FC<{ weight: Weight | null }> = ({ weight }) => {
  const maxBlockWeight = useStateObservable(maxBlockWeight$)
  if (!weight || !maxBlockWeight) return null

  const refTimeP = Number(weight.ref_time) / Number(maxBlockWeight.ref_time)
  const proofSizeP =
    Number(weight.proof_size) / Number(maxBlockWeight.proof_size)
  const pct = (progress: number) => Math.round(progress * 100) + "%"

  return (
    <div className="flex gap-2 items-center">
      <div className="flex flex-col items-center">
        <span>Ref Time</span>
        <CircularProgress progress={refTimeP} text={pct(refTimeP)} />
      </div>
      <div className="flex flex-col items-center">
        <span>Proof Size</span>
        <CircularProgress progress={proofSizeP} text={pct(proofSizeP)} />
      </div>
    </div>
  )
}

type Weight = {
  ref_time: bigint
  proof_size: bigint
}
function addWeight(a: Weight, b: Weight | null): Weight {
  if (!b) {
    console.warn("some weight is undefined", { a, b })
    return a
  }
  return {
    proof_size: a.proof_size + b.proof_size,
    ref_time: a.ref_time + b.ref_time,
  }
}

const statusRep: Record<BlockState, ReactNode> = {
  [BlockState.Best]: (
    <span className="inline-flex gap-1 items-center align-middle">
      <Clock className="text-blue-400" />
      Pending
    </span>
  ),
  [BlockState.Fork]: (
    <span className="inline-flex gap-1 items-center align-middle">
      <CircleAlert className="text-orange-400" />
      Fork
    </span>
  ),
  [BlockState.Finalized]: (
    <span className="inline-flex gap-1 items-center align-middle">
      <CircleCheck className="text-green-400" />
      Finalized
    </span>
  ),
  [BlockState.Pruned]: (
    <span className="inline-flex gap-1 items-center align-middle">
      <CircleX className="text-red-400" />
      Pruned
    </span>
  ),
}