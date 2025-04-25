import { CopyBinary } from "@/codec-components/ViewCodec/CopyBinary"
import { AccountIdDisplay } from "@/components/AccountIdDisplay"
import { ExpandBtn } from "@/components/Expand"
import { JsonDisplay } from "@/components/JsonDisplay"
import { Link } from "@/hashParams"
import { SystemEvent } from "@polkadot-api/observable-client"
import { toHex } from "@polkadot-api/utils"
import { Edit } from "lucide-react"
import { Enum, HexString, SS58String } from "polkadot-api"
import { FC, useEffect, useRef, useState } from "react"
import { twMerge } from "tailwind-merge"
import { DecodedExtrinsic } from "./extrinsicDecoder"

export type ApplyExtrinsicEvent = SystemEvent & {
  phase: { type: "ApplyExtrinsic" }
}
export const Extrinsic: FC<{
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
            <Link to={"/extrinsics#data=" + toHex(extrinsic.callData)}>
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
                <EventDisplay
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
        <AccountIdDisplay value={value} />
      </div>
    )
  )
}
