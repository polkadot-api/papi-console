import { Popover } from "@/components/Popover"
import { useStateObservable } from "@react-rxjs/core"
import { twMerge } from "tailwind-merge"
import { finalized$ } from "./block.state"
import { EventPopover } from "./EventPopover"
import { eventKey, recentEvents$ } from "./events.state"
import * as Finalizing from "./FinalizingTable"
import { Link } from "react-router-dom"

export const Events = () => {
  const events = useStateObservable(recentEvents$)
  const finalized = useStateObservable(finalized$)

  const finalizedIdx = finalized
    ? events.findIndex((evt) => evt.number <= finalized.number)
    : -1

  const numberSpan = (idx: number) => {
    const initialIdx = idx
    const key = eventKey(events[idx])
    do {
      idx++
    } while (key === eventKey(events[idx]))
    return idx - initialIdx
  }

  return (
    <Finalizing.Root>
      <Finalizing.Title>Recent Events</Finalizing.Title>
      <Finalizing.Table>
        {events.map((evt, idx) => {
          const key = eventKey(evt)
          const span = numberSpan(idx)

          if (!("extrinsicNumber" in evt)) {
            return (
              <Finalizing.Row
                key={key}
                number={events.length - idx}
                finalized={events.length - finalizedIdx}
                idx={idx}
                firstInGroup
              >
                <td className="p-2 whitespace-nowrap">
                  <Link to={`/explorer/${evt.hash}`}>
                    {evt.number.toLocaleString()}
                  </Link>
                </td>
                <td
                  className="p-1 w-full"
                  colSpan={2}
                >{`… ${evt.length} more extrinsics with events`}</td>
              </Finalizing.Row>
            )
          }

          const isFirstInGroup = eventKey(events[idx - 1]) !== key
          const isLastInGroup = eventKey(events[idx + 1]) !== key
          const isInGroup = !isFirstInGroup || !isLastInGroup

          return (
            <Finalizing.Row
              key={`${key}-${evt.index}`}
              number={events.length - idx}
              finalized={events.length - finalizedIdx}
              idx={idx}
              firstInGroup={isFirstInGroup}
            >
              {isFirstInGroup && (
                <td
                  className={twMerge(
                    "p-2 whitespace-nowrap",
                    isInGroup &&
                      twMerge(
                        idx > 0 ? "border-y" : "border-b",
                        "border-card-foreground/25",
                        idx === finalizedIdx && "border-t-card-foreground/50",
                        idx === finalizedIdx - span &&
                          "border-b-card-foreground/50",
                      ),
                  )}
                  rowSpan={span}
                >
                  <Link to={`/explorer/${evt.hash}#tx=${evt.index}`}>
                    {key}
                  </Link>
                </td>
              )}
              <td
                className={twMerge(
                  "p-1 w-full",
                  isInGroup &&
                    twMerge(
                      isFirstInGroup && idx > 0 && "border-t",
                      isLastInGroup && "border-b",
                      "border-card-foreground/25",
                      idx === finalizedIdx && "border-t-card-foreground/50",
                      idx === finalizedIdx - span &&
                        "border-b-card-foreground/50",
                    ),
                )}
              >
                {"event" in evt ? (
                  <Popover content={<EventPopover event={evt} />}>
                    <button className="w-full p-1 text-left text-card-foreground/80 hover:text-card-foreground/100">{`${evt.event.type}.${evt.event.value.type}`}</button>
                  </Popover>
                ) : (
                  `… ${evt.length} more`
                )}
              </td>
            </Finalizing.Row>
          )
        })}
      </Finalizing.Table>
      {events.length === 0 ? (
        <div className="text-slate-400">(No events yet)</div>
      ) : null}
    </Finalizing.Root>
  )
}
