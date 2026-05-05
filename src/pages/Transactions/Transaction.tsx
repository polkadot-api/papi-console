import { CopyText } from "@/components/Copy"
import { Link } from "@/hashParams"
import { shortStr } from "@/utils"
import { FileSearch, Trash2 } from "lucide-react"
import { TxBroadcastEvent } from "polkadot-api"
import { jsonSerialize, toHex } from "polkadot-api/utils"
import * as React from "react"
import { dismissTransaction, onGoingEvents } from "./transactions.state"

export const Transaction: React.FC<{
  event:
    | (TxBroadcastEvent & { raw: Uint8Array })
    | {
        type: "invalid" | "error"
        value: any
        txHash: string
        raw: Uint8Array
      }
  index: number
  onClose: () => void
}> = ({ event, index, onClose }) => {
  const getStatus = () => {
    const { type } = event
    switch (event.type) {
      case "error":
        return <span>There was an unexpected error.</span>
      case "invalid":
        return (
          <span>
            Invalid transaction. {JSON.stringify(event.value, jsonSerialize)}
          </span>
        )
      case "txBestBlocksState": {
        return event.found ? (
          <span>
            Transaction in{" "}
            <Link
              className="underline font-bold"
              to={`/explorer/${event.block.hash}#tx=${event.block.index}`}
              onClick={() => onClose()}
            >
              best block
            </Link>
            {event.ok ? "." : ", but it's failing."}
          </span>
        ) : (
          <span>Transaction no longer in a best block.</span>
        )
      }
      case "signed":
      case "broadcasted":
        return <span>Transaction {type}.</span>
      default:
        return (
          <span>
            Transaction in{" "}
            <Link
              className="underline font-bold"
              to={`/explorer/${event.block.hash}#tx=${event.block.index}`}
              onClick={() => onClose()}
            >
              {" "}
              finalized block
            </Link>
            {event.ok
              ? "."
              : `, but it failed: ${JSON.stringify(event.dispatchError, jsonSerialize)}.`}
          </span>
        )
    }
  }
  const { txHash, type } = event
  return (
    <div className="mb-4 p-3 bg-secondary/60 text-secondary-foreground/80 border border-border rounded-lg">
      <div className="flex justify-between items-start">
        <div className="min-w-0">
          <p className="font-medium">
            <span className="text-muted-foreground">{index + 1}.</span>{" "}
            {shortStr(txHash, 14)} <CopyText text={txHash} />
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to={`/extrinsics/analyzer#extrinsic=${toHex(event.raw)}`}>
            <FileSearch size={15} />
          </Link>
          <button
            className="text-red-500"
            onClick={() => dismissTransaction(txHash)}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      <p
        className={`text-sm ${
          onGoingEvents.has(type)
            ? "text-yellow-500"
            : type === "finalized" && event.ok
              ? "text-green-500"
              : "text-red-500"
        }`}
      >
        {getStatus()}
      </p>
    </div>
  )
}
