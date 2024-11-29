import { groupBy } from "@/lib/groupBy"
import type { SystemEvent } from "@polkadot-api/observable-client"
import { state } from "@react-rxjs/core"
import { combineKeys } from "@react-rxjs/utils"
import { filter, map, takeWhile } from "rxjs"
import { blockInfo$, BlockState, recordedBlocks$ } from "./block.state"

const blackList = new Set([
  "System.*",
  "Balances.Deposit",
  "Treasury.Deposit",
  "ParaInclusion.*",
  "Balances.Withdraw",
  "Balances.Endowed",
  "Balances.Locked",
  "TransactionPayment.TransactionFeePaid",
  "Staking.Rewarded",
])
const whitelist = new Set(["System.Remarked"])
export const filterEvt = (evt: SystemEvent) =>
  whitelist.has(`${evt.event.type}.${evt.event.value.type}`) ||
  (!blackList.has(`${evt.event.type}.*`) &&
    !blackList.has(`${evt.event.type}.${evt.event.value.type}`))

export interface EventInfo {
  status: BlockState
  hash: string
  number: number
  event: SystemEvent["event"]
  extrinsicNumber: number
  index: number
}
interface EventEllipsis {
  number: number
  extrinsicNumber: number
  length: number
  hash: string
  index: number
}
export const eventKey = (evt: EventInfo | EventEllipsis) =>
  `${evt?.number.toLocaleString()}-${evt?.extrinsicNumber}`
const MAX_GROUP_LENGTH = 7
export const recentEvents$ = state(
  combineKeys(recordedBlocks$, (key) =>
    blockInfo$(key).pipe(
      map((block) => ({
        status: block.status,
        hash: block.hash,
        number: block.number,
        events: block.events
          ?.map((evt, index) => ({ ...evt, index }))
          .filter((evt) => evt.phase.type === "ApplyExtrinsic")
          .filter(filterEvt)
          .map((evt) => ({
            index: evt.index,
            event: evt.event,
            extrinsicNumber: (evt.phase as any).value as number,
          })),
      })),
      takeWhile(
        (r) =>
          (r.status !== BlockState.Finalized &&
            r.status !== BlockState.Pruned) ||
          r.events == null,
        true,
      ),
      filter((result) => Boolean(result.events?.length)),
    ),
  ).pipe(
    map((events) =>
      [...events.values()]
        .reverse()
        .filter(
          (evt) =>
            evt.status === BlockState.Best ||
            evt.status === BlockState.Finalized,
        )
        .flatMap(({ status, hash, number, events }) => {
          const eventInfo = events!.map(
            ({ event, extrinsicNumber, index }): EventInfo => ({
              status,
              hash,
              number,
              event,
              extrinsicNumber,
              index,
            }),
          )
          const groupedEventInfo = groupBy(eventInfo, eventKey)

          return Object.values(groupedEventInfo).flatMap((group) => {
            if (group.length > MAX_GROUP_LENGTH) {
              const ellipsis: EventEllipsis = {
                length: group.length - MAX_GROUP_LENGTH + 1,
                extrinsicNumber: group[0].extrinsicNumber,
                number,
                hash,
                index: group.length,
              }
              return [...group.slice(0, MAX_GROUP_LENGTH - 1), ellipsis]
            }
            return group
          })
        }),
    ),
  ),
  [],
)
