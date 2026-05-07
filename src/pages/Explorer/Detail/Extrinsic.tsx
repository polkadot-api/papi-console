import { CopyBinary } from "@/codec-components/ViewCodec/CopyBinary"
import { CopyText } from "@/components/Copy"
import { ExpandBtn } from "@/components/Expand"
import {
  PriorityValue,
  Sender,
  SignedExtensions,
} from "@/components/Extrinsics"
import { JsonDisplay } from "@/components/JsonDisplay"
import { Link } from "@/hashParams"
import { cn, shortStr } from "@/utils"
import { SystemEvent } from "@polkadot-api/observable-client"
import { DecodedExtrinsic } from "@polkadot-api/tx-utils"
import { Edit, FileSearch } from "lucide-react"
import { HexString } from "polkadot-api"
import { toHex } from "polkadot-api/utils"
import { FC, ReactNode, useEffect, useRef, useState } from "react"
import { twMerge } from "tailwind-merge"

export type ApplyExtrinsicEvent = SystemEvent & {
  phase: { type: "ApplyExtrinsic" }
}
export const Extrinsic: FC<{
  extrinsic: DecodedExtrinsic & {
    idx: number
    raw: Uint8Array
    hash: HexString
  }
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
  const rawExtrinsic = toHex(extrinsic.raw)
  const txPayment =
    "extra" in extrinsic
      ? (extrinsic.extra.ChargeAssetTxPayment ??
        extrinsic.extra.ChargeTxPayment)
      : undefined

  let sender = extrinsic.type === "signed" ? extrinsic.address : null
  if (
    extrinsic.type === "general" &&
    extrinsic.extra.VerifyMultiSignature?.type === "Signed"
  ) {
    sender = extrinsic.extra.VerifyMultiSignature.value.account
  }

  return (
    <li className="overflow-hidden rounded-lg border border-foreground/10 bg-card text-card-foreground">
      <div className="flex items-center justify-between gap-2 px-2 py-2">
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex min-w-0 items-center gap-1 text-left"
        >
          <ExpandBtn expanded={expanded} className="shrink-0" />
          <div className="whitespace-nowrap overflow-hidden text-ellipsis">
            {extrinsic.idx}. {extrinsic.call.type}.{extrinsic.call.value.type}
          </div>
        </button>
        <div className="flex gap-2 items-center">
          <CopyBinary value={extrinsic.callData} />
          <Link to={`/extrinsics/analyzer#extrinsic=${rawExtrinsic}`}>
            <FileSearch size={15} />
          </Link>
          <Link to={"/extrinsics#data=" + toHex(extrinsic.callData)}>
            <Edit size={14} />
          </Link>
        </div>
      </div>
      {expanded ? (
        <div className="space-y-2 border-t border-foreground/10 px-2 py-2">
          <div className="flex gap-2 justify-stretch flex-col md:flex-row">
            {sender ? (
              <CompactBlock label="Signer">
                <Sender sender={sender} />
              </CompactBlock>
            ) : null}

            <CompactBlock label="Extrinsic Hash">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate font-mono text-sm">
                  {shortStr(extrinsic.hash, 6)}
                </span>
                <CopyText text={extrinsic.hash} binary />
              </div>
            </CompactBlock>

            <CompactBlock label="Priority" className="grow-0">
              <PriorityValue
                extrinsic={rawExtrinsic}
                txPayment={txPayment ?? {}}
              />
            </CompactBlock>
          </div>

          <CompactSection title="Call Payload">
            <div className="max-h-[80vh] overflow-auto">
              <JsonDisplay src={extrinsic.call.value.value} />
            </div>
          </CompactSection>

          <CompactSection title="Events">
            {events.length ? (
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
            ) : (
              <p className="text-sm text-muted-foreground">
                Couldn't load events
              </p>
            )}
          </CompactSection>

          {"extra" in extrinsic && (
            <CompactSection title="Signed Extensions">
              <SignedExtensions extra={extrinsic.extra} title={false} />
            </CompactSection>
          )}
        </div>
      ) : null}
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

const CompactSection: FC<{ title: string; children: ReactNode }> = ({
  title,
  children,
}) => (
  <div className="rounded-lg border border-foreground/10 bg-foreground/3 px-2 py-2">
    <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/50">
      {title}
    </div>
    {children}
  </div>
)

const CompactBlock: FC<{
  label: string
  children: ReactNode
  className?: string
}> = ({ label, children, className }) => (
  <div
    className={cn(
      "rounded-lg border border-foreground/10 bg-foreground/3 px-2 py-2 grow",
      className,
    )}
  >
    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/50">
      {label}
    </div>
    <div className="mt-1">{children}</div>
  </div>
)
