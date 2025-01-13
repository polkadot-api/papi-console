import { Loading } from "@/components/Loading"
import { groupBy } from "@/lib/groupBy"
import { runtimeCtx$ } from "@/state/chains/chain.state"
import * as Tabs from "@radix-ui/react-tabs"
import { state, useStateObservable } from "@react-rxjs/core"
import { FC, useState } from "react"
import { useLocation, useParams } from "react-router-dom"
import { combineLatest, distinctUntilChanged, filter, map, take } from "rxjs"
import { twMerge } from "tailwind-merge"
import { BlockInfo, blockInfoState$ } from "../block.state"
import { ApplyExtrinsicEvent, Extrinsic } from "./Extrinsic"
import { createExtrinsicCodec, DecodedExtrinsic } from "./extrinsicDecoder"

const blockExtrinsics$ = state((hash: string) => {
  const decoder$ = runtimeCtx$.pipe(
    map(({ dynamicBuilder, lookup }) =>
      createExtrinsicCodec(dynamicBuilder, lookup),
    ),
  )
  const body$ = blockInfoState$(hash).pipe(
    filter((v) => !!v),
    map((v) => v.body),
    filter((v) => !!v),
    distinctUntilChanged(),
  )

  return combineLatest([body$, decoder$]).pipe(
    map(([body, decoder]): Array<DecodedExtrinsic> => body.map(decoder)),
    // Assuming the body or the decoder won't change or won't have any effect.
    take(1),
  )
}, [])

export const BlockBody: FC<{
  block: BlockInfo
}> = ({ block }) => {
  const { hash } = useParams()
  const [selectedTab, setSelectedTab] = useState<"signed" | "unsigned" | null>(
    null,
  )
  const extrinsics = useStateObservable(blockExtrinsics$(hash ?? ""))
  const location = useLocation()
  const hashParams = new URLSearchParams(location.hash.slice(1))
  const eventParam = hashParams.get("event")
  const defaultEventOpen =
    eventParam && block?.events
      ? (block.events[Number(eventParam)] as ApplyExtrinsicEvent)
      : null
  const eventsByExtrinsic = block?.events
    ? groupBy(
        block.events.filter(
          (evt): evt is ApplyExtrinsicEvent =>
            evt.phase.type === "ApplyExtrinsic",
        ),
        (evt) => evt.phase.value,
      )
    : null

  if (!block) return <Loading>Loading block…</Loading>

  const groupedExtrinsics = groupBy(
    extrinsics.map((e, index) => ({ ...e, index })),
    (e) => (e.signed ? "signed" : ("unsigned" as const)),
  )
  const defaultTab =
    defaultEventOpen?.phase.type === "ApplyExtrinsic"
      ? extrinsics[defaultEventOpen.phase.value].signed
        ? "signed"
        : "unsigned"
      : groupedExtrinsics.signed?.length
        ? "signed"
        : "unsigned"
  const effectiveTab = selectedTab
    ? groupedExtrinsics[selectedTab]?.length
      ? selectedTab
      : selectedTab === "signed"
        ? "unsigned"
        : "signed"
    : defaultTab

  return (
    <div className="p-2">
      <Tabs.Root
        className="flex flex-col"
        value={effectiveTab}
        onValueChange={(t) => setSelectedTab(t as any)}
      >
        <Tabs.List className="flex-shrink-0 flex border-b border-polkadot-200">
          <Tabs.Trigger
            className={twMerge(
              "bg-secondary text-secondary-foreground/80 px-4 py-2 hover:text-polkadot-500 border-t border-x rounded-tl border-polkadot-200",
              "disabled:text-secondary-foreground/50 disabled:bg-secondary/50 disabled:pointer-events-none",
              "data-[state=active]:font-bold data-[state=active]:text-secondary-foreground",
            )}
            value="signed"
            disabled={!groupedExtrinsics.signed?.length}
          >
            Signed
          </Tabs.Trigger>
          <Tabs.Trigger
            className={twMerge(
              "bg-secondary text-secondary-foreground/80 px-4 py-2 hover:text-polkadot-500 border-t border-r rounded-tr border-polkadot-200",
              "disabled:text-secondary-foreground/50 disabled:pointer-events-none",
              "data-[state=active]:font-bold data-[state=active]:text-secondary-foreground",
            )}
            value="unsigned"
            disabled={!groupedExtrinsics.unsigned?.length}
          >
            Unsigned
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="signed" className="py-2">
          <ol>
            {groupedExtrinsics.signed?.map((extrinsic) => (
              <Extrinsic
                key={extrinsic.index}
                extrinsic={extrinsic}
                highlightedEvent={defaultEventOpen}
                events={eventsByExtrinsic?.[extrinsic.index] ?? []}
              />
            ))}
          </ol>
        </Tabs.Content>
        <Tabs.Content value="unsigned" className="py-2">
          <ol>
            {groupedExtrinsics.unsigned?.map((extrinsic) => (
              <Extrinsic
                key={extrinsic.index}
                extrinsic={extrinsic}
                highlightedEvent={defaultEventOpen}
                events={eventsByExtrinsic?.[extrinsic.index] ?? []}
              />
            ))}
          </ol>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  )
}
