import { runtimeCtx$ } from "@/state/chains/chain.state"
import { CopyBinary } from "@/codec-components/ViewCodec/CopyBinary"
import { AccountIdDisplay } from "@/components/AccountIdDisplay"
import { ExpandBtn } from "@/components/Expand"
import { JsonDisplay } from "@/components/JsonDisplay"
import { Loading } from "@/components/Loading"
import { groupBy } from "@/lib/groupBy"
import { SystemEvent } from "@polkadot-api/observable-client"
import { toHex } from "@polkadot-api/utils"
import * as Tabs from "@radix-ui/react-tabs"
import { state, useStateObservable } from "@react-rxjs/core"
import { combineKeys } from "@react-rxjs/utils"
import { Edit } from "lucide-react"
import { FC, useEffect, useRef, useState } from "react"
import { Link, useLocation, useParams } from "react-router-dom"
import {
  combineLatest,
  distinctUntilChanged,
  filter,
  map,
  startWith,
  switchMap,
  take,
} from "rxjs"
import { twMerge } from "tailwind-merge"
import { blockInfoState$, blocksByHeight$, BlockState } from "../block.state"
import { BlockStatusIcon, statusText } from "./BlockState"
import { createExtrinsicCodec, DecodedExtrinsic } from "./extrinsicDecoder"
import { CopyText } from "@/components/Copy"
import { Enum, HexString, SS58String } from "polkadot-api"

const Sender: React.FC<{
  sender: Enum<{ Id: SS58String }> | SS58String | HexString
}> = ({ sender }) => {
  const value: string | null =
    typeof sender === "string"
      ? sender
      : "type" in sender && sender.type === "Id"
        ? sender.value
        : null
  return (
    value && (
      <div className="flex gap-2 items-center py-2">
        Signer:
        <AccountIdDisplay value={value} />
      </div>
    )
  )
}

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

type ApplyExtrinsicEvent = SystemEvent & { phase: { type: "ApplyExtrinsic" } }
export const BlockDetail = () => {
  const { hash } = useParams()
  const [selectedTab, setSelectedTab] = useState<"signed" | "unsigned" | null>(
    null,
  )
  const block = useStateObservable(blockInfoState$(hash ?? ""))
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
    <div>
      <div className="p-2">
        <div className="flex flex-wrap justify-between">
          <h2 className="font-bold text-xl whitespace-nowrap overflow-hidden text-ellipsis">
            Block {block.hash}
          </h2>
          <p className="text-xl">{block.number.toLocaleString()}</p>
        </div>
        <p className="flex gap-1 items-center py-1">
          Status:
          <BlockStatusIcon state={block.status} />
          {statusText[block.status]}
        </p>
        <div className="flex flex-wrap justify-between">
          <div className="flex flex-col">
            <div>Parent</div>
            <BlockLink hash={block.parent} />
          </div>
          <div className="flex flex-col items-end">
            <div>Children</div>
            <BlockChildren hash={block.hash} />
          </div>
        </div>
        {block.header && (
          <div className="text-foreground/80 py-2">
            <p>
              State root: {block.header.stateRoot.slice(0, 18)}{" "}
              <CopyText
                className="align-middle"
                text={block.header.stateRoot}
                binary
              />
            </p>
            <p>
              Extrinsic root: {block.header.extrinsicRoot.slice(0, 18)}{" "}
              <CopyText
                className="align-middle"
                text={block.header.extrinsicRoot}
                binary
              />
            </p>
          </div>
        )}
      </div>
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
    </div>
  )
}

const childBlocks$ = state(
  (hash: string) =>
    blockInfoState$(hash).pipe(
      filter((v) => !!v),
      take(1),
      switchMap(({ hash, number }) =>
        combineKeys(
          blocksByHeight$.pipe(
            map((v) => v[number + 1]),
            map((v) =>
              v
                ? [...v.values()]
                    .filter((block) => block.parent === hash)
                    .map((block) => block.hash)
                : [],
            ),
          ),
          (hash) =>
            blockInfoState$(hash).pipe(
              filter((v) => !!v),
              startWith({ hash }),
            ),
        ),
      ),
      map((children) =>
        [...children.values()]
          .sort((a, b) => {
            const valueOf = (v: typeof a) =>
              "status" in v ? statusValue[v.status] : 0
            return valueOf(a) - valueOf(b)
          })
          .map((v) => v.hash),
      ),
    ),
  [],
)
const statusValue: Record<BlockState, number> = {
  [BlockState.Finalized]: 3,
  [BlockState.Best]: 2,
  [BlockState.Fork]: 1,
  [BlockState.Pruned]: 0,
}

const BlockChildren: FC<{ hash: string }> = ({ hash }) => {
  const childBlocks = useStateObservable(childBlocks$(hash))

  return childBlocks.length ? (
    <span className="inline-flex gap-2 align-middle">
      {childBlocks.map((hash) => (
        <BlockLink key={hash} hash={hash} />
      ))}
    </span>
  ) : (
    <span className="text-slate-400">N/A</span>
  )
}

const BlockLink: FC<{ hash: string }> = ({ hash }) => {
  const block = useStateObservable(blockInfoState$(hash))

  if (!block) {
    return <span className="align-middle">{hash.slice(0, 12)}…</span>
  }

  return (
    <Link
      className="text-primary/70 hover:text-primary align-middle inline-flex items-center gap-1 underline"
      to={`../${hash}`}
    >
      {<BlockStatusIcon state={block.status} size={20} />}
      {hash.slice(0, 12)}…
    </Link>
  )
}

const Extrinsic: FC<{
  extrinsic: DecodedExtrinsic
  highlightedEvent: ApplyExtrinsicEvent | null
  events: ApplyExtrinsicEvent[]
}> = ({ extrinsic, events, highlightedEvent }) => {
  const [expanded, setExpanded] = useState(
    (highlightedEvent && events.includes(highlightedEvent)) ?? false,
  )

  return (
    <li className="p-2 border rounded mb-2 bg-card text-card-foreground">
      <div className="flex justify-between items-center">
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex gap-1 items-center"
        >
          <ExpandBtn expanded={expanded} />
          {extrinsic.call.type}.{extrinsic.call.value.type}
        </button>
        <div className="flex gap-2 items-center">
          <CopyBinary value={extrinsic.callData} />
          {extrinsic.callData.length > 1024 ? (
            <span className="opacity-50">
              <Edit size={14} />
            </span>
          ) : (
            <Link to={"/extrinsics#" + toHex(extrinsic.callData)}>
              <Edit size={14} />
            </Link>
          )}
        </div>
      </div>
      {expanded ? (
        <div className="overflow-hidden">
          {extrinsic.signed && (
            <div>
              <Sender sender={extrinsic.sender} />
              <SignedExtensions extra={extrinsic.extra} />
            </div>
          )}
          <div className="overflow-auto max-h-[80vh] p-2">
            <JsonDisplay src={extrinsic.call.value.value} />
          </div>
          <div className="p-2 overflow-auto max-h-[80vh] border-t">
            <ol className="flex flex-col gap-1">
              {events.map((evt, i) => (
                <ExtrinsicEvent
                  key={i}
                  index={i}
                  evt={evt}
                  defaultOpen={highlightedEvent === evt}
                />
              ))}
            </ol>
          </div>
        </div>
      ) : null}
    </li>
  )
}

const SignedExtensions: FC<{ extra: unknown }> = () => {
  // TODO maybe?
  return null
}

const ExtrinsicEvent: FC<{
  evt: ApplyExtrinsicEvent
  index: number
  defaultOpen: boolean
}> = ({ evt, index, defaultOpen }) => {
  const [expanded, setExpanded] = useState(defaultOpen)
  const ref = useRef<HTMLLIElement>(null)

  useEffect(() => {
    if (defaultOpen) {
      ref.current?.scrollIntoView()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <li
      className={twMerge(
        "px-2 py-1",
        expanded && "py-2 bg-white bg-opacity-10 rounded overflow-auto",
      )}
      ref={ref}
    >
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex gap-1 items-center"
      >
        <span>{index}.</span>
        <ExpandBtn expanded={expanded} />
        <span>{`${evt.event.type}.${evt.event.value.type}`}</span>
      </button>
      {expanded && <JsonDisplay src={evt.event.value.value} />}
    </li>
  )
}
