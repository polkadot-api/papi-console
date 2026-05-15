import { CopyText } from "@/components/Copy"
import {
  OperationStatus,
  pushWorkspaceEntry,
  setHistoryOpen,
} from "@/components/HistoryDrawer/historyDrawer.state"
import { JsonDisplay } from "@/components/JsonDisplay"
import { Link } from "@/hashParams"
import { BlockState } from "@/state/block.state"
import { chainClient$ } from "@/state/chains/chain.state"
import { shortStr } from "@/utils"
import { FileSearch, Send } from "lucide-react"
import { InvalidTxError, TxBroadcastEvent, TxCallData } from "polkadot-api"
import { jsonSerialize, toHex } from "polkadot-api/utils"
import { Account } from "polkahub"
import { FC } from "react"
import { catchError, map, Observable, of, shareReplay, tap } from "rxjs"
import { BlockStatusIcon } from "../Explorer/Detail/BlockState"

type TrackedTransactionEvent =
  | (TxBroadcastEvent & { raw: Uint8Array; callData: TxCallData })
  | {
      type: "invalid" | "error"
      value: any
      txHash: string
      raw: Uint8Array
      callData: TxCallData
    }

const onGoingEvents = new Set(["signed", "broadcasted", "txBestBlocksState"])

export const trackTx = async (
  extrinsic: Uint8Array,
  callData: TxCallData,
  signer?: Account,
) => {
  const { client } = await chainClient$.getValue()

  let txHash: string = ""
  const tx$: Observable<TrackedTransactionEvent> = client
    .submitAndWatch(extrinsic)
    .pipe(
      tap((e) => {
        txHash = e.txHash
      }),
      map((event) => ({
        ...event,
        raw: extrinsic,
        callData,
      })),
      catchError((err) => {
        console.error(err)
        console.log(extrinsic, client.getFinalizedBlock())

        return of({
          type:
            err instanceof InvalidTxError
              ? ("invalid" as const)
              : ("error" as const),
          txHash,
          raw: extrinsic,
          callData,
          value: err,
        })
      }),
      shareReplay(1),
    )

  const title = callData ? `${callData.type}.${callData.value.type}` : null

  pushWorkspaceEntry({
    source: "Extrinsics",
    title: title ?? "Transaction",
    // TODO correct format
    subtitle: signer ? `Signer ${signer.name ?? signer.address}` : undefined,
    icon: Send,
    progress: tx$.pipe(map(getOperationStatus)),
    contentData: tx$,
    content: ({ data }) => <ExtrinsicsWorkspaceEntry event={data} />,
  })
  // Forcing it to open as it's the only place where Transactions are tracked
  setHistoryOpen(true)
}

const ExtrinsicsWorkspaceEntry: FC<{ event: TrackedTransactionEvent }> = ({
  event,
}) => {
  return (
    <div className="space-y-2 p-2 text-sm">
      <div className="flex items-center gap-2">
        <span>Hash:</span>
        <span className="flex-1 truncate font-mono">
          {event.txHash ? shortStr(event.txHash, 8) : "Unknown"}
        </span>
        <CopyText text={event.txHash} disabled={!event.txHash} size={14} />
        <Link to={`/extrinsics/analyzer#extrinsic=${toHex(event.raw)}`}>
          <FileSearch size={14} />
        </Link>
      </div>
      {"block" in event ? (
        <div className="flex items-center gap-1">
          <span>Block:</span>
          <BlockStatusIcon
            size={20}
            state={
              event.type === "finalized"
                ? BlockState.Finalized
                : BlockState.Best
            }
          />
          <Link
            className="truncate underline font-bold"
            to={`/explorer/${event.block.hash}#tx=${event.block.index}`}
          >
            {shortStr(event.block.hash, 8)}
          </Link>
        </div>
      ) : (
        <p className={getStatusClassName(event)}>{getStatus(event)}</p>
      )}
      {"ok" in event ? (
        <div className="flex items-center gap-1">
          <span>Status:</span>
          {event.ok ? (
            <span className="flex-1 text-green-500">Succeeded</span>
          ) : (
            <span className="flex-1 truncate text-red-500">
              Failed:{" "}
              <span className="font-mono">
                {JSON.stringify(event.dispatchError, jsonSerialize)}.
              </span>
            </span>
          )}
        </div>
      ) : null}
      <div className="text-xs">
        <JsonDisplay src={event.callData.value.value} />
      </div>
    </div>
  )
}

const getStatus = (event: TrackedTransactionEvent) => {
  switch (event.type) {
    case "error":
      return "There was an unexpected error."
    case "invalid":
      return `Invalid transaction. ${JSON.stringify(event.value, jsonSerialize)}`
    case "txBestBlocksState":
      return event.found
        ? `Transaction in best block${event.ok ? "." : ", but it's failing."}`
        : "Transaction no longer in a best block."
    case "signed":
    case "broadcasted":
      return `Transaction ${event.type}.`
    default:
      return event.ok
        ? "Transaction in finalized block."
        : `Transaction finalized, but failed: ${JSON.stringify(event.dispatchError, jsonSerialize)}.`
  }
}

const getStatusClassName = (event: TrackedTransactionEvent) => {
  if (onGoingEvents.has(event.type)) return "text-yellow-500"
  if (event.type === "finalized" && event.ok) return "text-green-500"
  return "text-red-500"
}

const getOperationStatus = (
  event: TrackedTransactionEvent,
): OperationStatus => {
  if (onGoingEvents.has(event.type)) return "pending"
  if (event.type === "finalized" && event.ok) return "done"
  return "error"
}
