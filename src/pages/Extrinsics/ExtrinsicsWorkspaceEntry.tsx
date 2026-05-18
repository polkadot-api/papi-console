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
      <dl className="grid grid-cols-[4em_minmax(0,1fr)] gap-x-3 gap-y-2">
        <div className="contents">
          <dt className="text-muted-foreground">Status</dt>
          <dd className="truncate flex items-center gap-1">
            {getStatus(event)}
          </dd>
        </div>
        <div className="contents">
          <dt className="text-muted-foreground">Extrinsic</dt>
          <dd className="truncate font-mono flex items-center gap-1">
            <Link
              className="underline"
              to={`/extrinsics/analyzer#extrinsic=${toHex(event.raw)}`}
            >
              {shortStr(toHex(event.raw), 8)}
            </Link>
          </dd>
        </div>
        <div className="contents">
          <dt className="text-muted-foreground">Hash</dt>
          <dd className="truncate font-mono flex items-center gap-1">
            {event.txHash ? shortStr(event.txHash, 8) : ""}
            <CopyText text={event.txHash} disabled={!event.txHash} size={14} />
          </dd>
        </div>
        {"block" in event ? (
          <div className="contents">
            <dt className="text-muted-foreground">Block</dt>
            <dd className="truncate font-mono  flex items-center gap-1">
              <Link
                className="truncate underline"
                to={`/explorer/${event.block.hash}#tx=${event.block.index}`}
              >
                {shortStr(event.block.hash, 8)}
              </Link>
              <BlockStatusIcon
                size={20}
                state={
                  event.type === "finalized"
                    ? BlockState.Finalized
                    : BlockState.Best
                }
              />
            </dd>
          </div>
        ) : null}
        {"ok" in event ? (
          <div className="contents">
            <dt className="text-muted-foreground">Result</dt>
            <dd className="truncate font-bold">
              {event.ok ? (
                <span className="text-green-500">Succeeded</span>
              ) : (
                <span className="truncate text-red-500">
                  Failed:{" "}
                  <span className="font-mono">
                    {JSON.stringify(event.dispatchError, jsonSerialize)}.
                  </span>
                </span>
              )}
            </dd>
          </div>
        ) : null}
        {event.type === "error" ? (
          <div className="contents">
            <dt className="text-muted-foreground">Error</dt>
            <dd className="truncate font-bold font-mono text-red-500">
              {JSON.stringify(event.value, jsonSerialize)}
            </dd>
          </div>
        ) : null}
      </dl>
      <div className="text-xs">
        <JsonDisplay src={event.callData.value.value} />
      </div>
    </div>
  )
}

const getStatus = (event: TrackedTransactionEvent): string => {
  switch (event.type) {
    case "error":
      return "Unexpected error"
    case "invalid":
      return `Invalid`
    case "txBestBlocksState":
      return event.found ? `Found in best block` : "No longer in a best block"
    case "signed":
      return `Signed`
    case "broadcasted":
      return `Broadcasting`
    case "finalized":
      return "Finalized"
  }
}

const getOperationStatus = (
  event: TrackedTransactionEvent,
): OperationStatus => {
  if (onGoingEvents.has(event.type)) return "pending"
  if (event.type === "finalized" && event.ok) return "done"
  return "error"
}
