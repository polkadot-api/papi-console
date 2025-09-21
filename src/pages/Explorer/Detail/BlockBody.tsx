import { Chopsticks } from "@/components/Icons"
import { Loading } from "@/components/Loading"
import { groupBy } from "@/lib/groupBy"
import { runtimeCtxAt$ } from "@/state/chains/chain.state"
import * as Tabs from "@radix-ui/react-tabs"
import { state, useStateObservable } from "@react-rxjs/core"
import { FC, useState } from "react"
import { useLocation, useParams } from "react-router-dom"
import { combineLatest, distinctUntilChanged, filter, map, take } from "rxjs"
import { twMerge } from "tailwind-merge"
import { BlockInfo, blockInfoState$ } from "../block.state"
import { BlockEvents } from "./BlockEvents"
import { BlockStorageDiff } from "./BlockStorageDiff"
import { ApplyExtrinsicEvent, Extrinsic } from "./Extrinsic"
import { getHashParams } from "@/hashParams"
import { Blake2256 } from "@polkadot-api/substrate-bindings"
import { fromHex, toHex } from "@polkadot-api/utils"

const blockExtrinsics$ = state((hash: string) => {
  const body$ = blockInfoState$(hash).pipe(
    filter((v) => !!v),
    map((v) => v.body),
    filter((v) => !!v),
    distinctUntilChanged(),
  )

  return combineLatest([body$, runtimeCtxAt$(hash)]).pipe(
    take(1),
    map(([body, { txDecoder }]) =>
      body.map((raw, idx) => ({
        idx,
        hash: toHex(Blake2256(fromHex(raw))),
        ...txDecoder(raw),
      })),
    ),
  )
}, [])

type Tab = "tx" | "events" | "diff"
export const BlockBody: FC<{
  block: BlockInfo
}> = ({ block }) => {
  const { hash } = useParams()
  const [selectedTab, setSelectedTab] = useState<Tab | null>(null)
  const extrinsics = useStateObservable(blockExtrinsics$(hash ?? ""))

  const location = useLocation()
  const hashParams = getHashParams(location)
  const eventParam = hashParams.get("event")
  const txParam = hashParams.get("tx")
  const defaultEventOpen =
    eventParam && block.events ? block.events[Number(eventParam)] : null
  let defaultTxOpen = txParam && !defaultEventOpen ? Number(txParam) : null
  defaultTxOpen = defaultTxOpen! < extrinsics.length ? defaultTxOpen : null
  const eventsByExtrinsic = block.events
    ? groupBy(
        block.events.filter(
          (evt): evt is ApplyExtrinsicEvent =>
            evt.phase.type === "ApplyExtrinsic",
        ),
        (evt) => evt.phase.value,
      )
    : null

  if (!block) return <Loading>Loading block…</Loading>

  // This is done separately in case the extrinsics/events have not fully loaded yet.
  const getDefaultTab = (): Tab => {
    if (defaultEventOpen) {
      const extrinsic =
        defaultEventOpen.phase.type === "ApplyExtrinsic"
          ? extrinsics[defaultEventOpen.phase.value]
          : null
      return extrinsic ? "tx" : "events"
    }
    return extrinsics.length ? "tx" : "events"
  }

  const effectiveTab = selectedTab ?? getDefaultTab()

  return (
    <div className="p-2">
      <Tabs.Root
        className="flex flex-col"
        value={effectiveTab}
        onValueChange={(t) => setSelectedTab(t as any)}
      >
        <Tabs.List className="shrink-0 flex border-b border-polkadot-200">
          <Tabs.Trigger
            className={twMerge(
              "bg-secondary text-secondary-foreground/80 px-4 py-2 hover:text-polkadot-500 border-t border-x rounded-tl border-polkadot-200",
              "disabled:text-secondary-foreground/50 disabled:bg-secondary/50 disabled:pointer-events-none",
              "data-[state=active]:font-bold data-[state=active]:text-secondary-foreground",
            )}
            value="tx"
            disabled={!extrinsics.length}
          >
            Extrinsics
          </Tabs.Trigger>
          <Tabs.Trigger
            className={twMerge(
              "bg-secondary text-secondary-foreground/80 px-4 py-2 hover:text-polkadot-500 border-t border-r last:rounded-tr border-polkadot-200",
              "disabled:text-secondary-foreground/50 disabled:pointer-events-none",
              "data-[state=active]:font-bold data-[state=active]:text-secondary-foreground",
            )}
            value="events"
          >
            Events
          </Tabs.Trigger>
          {block.diff && (
            <Tabs.Trigger
              className={twMerge(
                "bg-secondary text-secondary-foreground/80 px-4 py-2 hover:text-polkadot-500 border-t border-r rounded-tr border-polkadot-200",
                "disabled:text-secondary-foreground/50 disabled:bg-secondary/50 disabled:pointer-events-none",
                "data-[state=active]:font-bold data-[state=active]:text-secondary-foreground",
              )}
              value="diff"
            >
              Diff
              <Chopsticks
                className="inline-block align-middle ml-2"
                size={20}
              />
            </Tabs.Trigger>
          )}
        </Tabs.List>
        <Tabs.Content value="tx" className="py-2">
          <ol>
            {extrinsics.map((extrinsic, idx) => (
              <Extrinsic
                key={idx}
                isOpen={defaultTxOpen === idx}
                extrinsic={extrinsic}
                highlightedEvent={defaultEventOpen}
                events={eventsByExtrinsic?.[idx] ?? []}
              />
            ))}
          </ol>
        </Tabs.Content>
        <Tabs.Content value="events" className="py-2">
          <BlockEvents block={block} highlightedEvent={defaultEventOpen} />
        </Tabs.Content>
        <Tabs.Content value="diff" className="py-2">
          <BlockStorageDiff block={block} />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  )
}
