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
  "Treasury.UpdatedInactive",
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
  extrinsicNumber: number | "i" | "f"
  index: number
}
interface EventEllipsis {
  number: number
  extrinsicNumber: number | "i" | "f"
  length: number
  hash: string
  index: number
}
interface BlockEllipsis {
  number: number
  length: number
  hash: string
}

export const eventKey = (evt?: EventInfo | EventEllipsis | BlockEllipsis) =>
  `${evt?.number.toLocaleString()}-${evt ? ("extrinsicNumber" in evt ? evt.extrinsicNumber : "block_ellipsis") : "N/A"}`

// Maximum events per extrinsic
const MAX_GROUP_LENGTH = 7
// Maximum extrinsics per block
const MAX_BLOCK_LENGTH = 5
// Max amount of total rows
const MAX_LENGTH = 600
export const recentEvents$ = state(
  combineKeys(recordedBlocks$, (key) =>
    blockInfo$(key).pipe(
      map((block) => ({
        status: block.status,
        hash: block.hash,
        number: block.number,
        events: block.events
          ?.map((evt, index) => ({ ...evt, index }))
          .filter(filterEvt)
          .map((evt) => ({
            index: evt.index,
            event: evt.event,
            extrinsicNumber:
              evt.phase.type === "ApplyExtrinsic"
                ? evt.phase.value
                : evt.phase.type === "Initialization"
                  ? ("i" as const)
                  : ("f" as const),
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
        .flatMap(
          ({
            status,
            hash,
            number,
            events,
          }): Array<EventInfo | EventEllipsis | BlockEllipsis> => {
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

            const groupedEvents = Object.values(groupedEventInfo).map(
              (group) => {
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
              },
            )

            const rows =
              groupedEvents.length > MAX_BLOCK_LENGTH
                ? [
                    ...groupedEvents.slice(0, MAX_BLOCK_LENGTH - 1),
                    [
                      {
                        hash,
                        length: groupedEvents.length - MAX_BLOCK_LENGTH + 1,
                        number,
                      },
                    ],
                  ].flat()
                : groupedEvents.flat()
            return rows.slice(0, MAX_LENGTH)
          },
        ),
    ),
  ),
  [],
)
