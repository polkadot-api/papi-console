import { CopyBinary } from "@/codec-components/ViewCodec/CopyBinary"
import { AccountIdDisplay } from "@/components/AccountIdDisplay"
import { CopyText } from "@/components/Copy"
import { EthAccountDisplay } from "@/components/EthAccountDisplay"
import { ExpandBtn } from "@/components/Expand"
import { JsonDisplay } from "@/components/JsonDisplay"
import { Link } from "@/hashParams"
import { shortStr } from "@/utils"
import { SystemEvent } from "@polkadot-api/observable-client"
import { DecodedExtrinsic } from "@polkadot-api/tx-utils"
import { Dot, Edit } from "lucide-react"
import { Binary, Enum, HexString, SS58String } from "polkadot-api"
import { FC, useEffect, useRef, useState } from "react"
import { twMerge } from "tailwind-merge"

export type ApplyExtrinsicEvent = SystemEvent & {
  phase: { type: "ApplyExtrinsic" }
}
export const Extrinsic: FC<{
  extrinsic: DecodedExtrinsic & { idx: number; hash: HexString }
  highlightedEvent: SystemEvent | null
  events: ApplyExtrinsicEvent[]
  isOpen?: boolean
}> = ({ extrinsic, isOpen, events, highlightedEvent }) => {
  const [expanded, setExpanded] = useState(
    !!(
      isOpen ||
      (highlightedEvent &&
        events.includes(highlightedEvent as ApplyExtrinsicEvent))
    ),
  )

  return (
    <li className="p-2 border rounded mb-2 bg-card text-card-foreground">
      <div className="flex justify-between items-center">
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex gap-1 items-center"
        >
          <ExpandBtn expanded={expanded} />
          {extrinsic.idx}. {extrinsic.call.type}.{extrinsic.call.value.type}
        </button>
        <div className="flex gap-2 items-center">
          <CopyBinary value={extrinsic.callData.asBytes()} />
          {extrinsic.callData.asBytes().length > 1024 ? (
            <span className="opacity-50">
              <Edit size={14} />
            </span>
          ) : (
            <Link to={"/extrinsics#data=" + extrinsic.callData.asHex()}>
              <Edit size={14} />
            </Link>
          )}
        </div>
      </div>
      {expanded ? (
        <div className="overflow-hidden">
          <div className="flex gap-2 items-center py-2">
            Extrinsic Hash: {shortStr(extrinsic.hash, 6)}{" "}
            <CopyText text={extrinsic.hash} binary />
          </div>

          {extrinsic.type === "signed" && (
            <div>
              <Sender sender={extrinsic.address} />
            </div>
          )}
          <div className="overflow-auto max-h-[80vh] p-2">
            <JsonDisplay src={extrinsic.call.value.value} />
          </div>
          <div className="p-2 overflow-auto max-h-[80vh] border-t">
            <ol className="flex flex-col gap-1">
              {events.map((evt, i) => (
                <EventDisplay
                  key={i}
                  index={i}
                  evt={evt}
                  defaultOpen={highlightedEvent === evt}
                />
              ))}
            </ol>
          </div>
          {"extra" in extrinsic && (
            <div className="p-2 overflow-auto max-h-[80vh] border-t">
              <SignedExtensions extra={extrinsic.extra} />
            </div>
          )}
        </div>
      ) : null}
    </li>
  )
}

const SignedExtensions: FC<{ extra: Record<string, unknown> }> = ({
  extra,
}) => (
  <div className="space-y-2">
    <h3>Signed extensions</h3>
    <ul className="space-y-2">
      {Object.entries(extra).map(([key, value]) => (
        <SignedExtension key={key} id={key} value={value} />
      ))}
    </ul>
  </div>
)

const SignedExtension: FC<{ id: string; value: unknown }> = ({ id, value }) => {
  const [expanded, setExpanded] = useState(false)
  const inlineJson = JSON.stringify(value, (_, v) =>
    typeof v === "bigint" ? String(v) : v instanceof Binary ? v.asHex() : v,
  )

  if (!inlineJson || inlineJson.length < 40) {
    return (
      <li className="flex items-center flex-wrap gap-1">
        <div className="flex gap-2 items-center">
          <Dot size={16} />
          {id}
        </div>
        {inlineJson ? (
          <div className="whitespace-nowrap">
            - <span className="font-mono text-sm">{inlineJson}</span>
          </div>
        ) : null}
      </li>
    )
  }
  return (
    <li className="space-y-2">
      <div className="flex gap-2 items-center">
        <ExpandBtn expanded={expanded} onClick={() => setExpanded((e) => !e)} />
        {id}
      </div>
      {expanded && <JsonDisplay src={value} />}
    </li>
  )
}

export const EventDisplay: FC<{
  evt: SystemEvent
  index: number
  defaultOpen?: boolean
}> = ({ evt, index, defaultOpen }) => {
  const [expanded, setExpanded] = useState(defaultOpen ?? false)
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
        expanded && "py-2 bg-foreground/5 rounded overflow-auto",
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
        {value.startsWith("0x") ? (
          <EthAccountDisplay value={value} />
        ) : (
          <AccountIdDisplay value={value} />
        )}
      </div>
    )
  )
}
