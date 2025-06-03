import { CopyText } from "@/components/Copy"
import { Link } from "@/hashParams"
import { shortStr } from "@/utils"
import { TxBroadcastEvent } from "polkadot-api"
import * as React from "react"
import { dismissTransaction, onGoingEvents } from "./transactions.state"
import { Trash2 } from "lucide-react"
import { jsonPrint } from "@polkadot-api/utils"

export const Transaction: React.FC<{
  event:
    | TxBroadcastEvent
    | {
        type: "invalid" | "error"
        value: any
        txHash: string
      }
  onClose: () => void
}> = ({ event, onClose }) => {
  const getStatus = () => {
    const { type } = event
    switch (event.type) {
      case "error":
        return <span>There was an unexpected error.</span>
      case "invalid":
        return <span>Invalid transaction. {jsonPrint(event.value)}</span>
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
              : `, but it failed: ${jsonPrint(event.dispatchError)}.`}
          </span>
        )
    }
  }
  const { txHash, type } = event
  return (
    <div className="mb-4 p-3 bg-secondary/60 text-secondary-foreground/80 border border-border rounded-lg">
      <div className="flex justify-between items-start">
        <p className="font-medium">
          {shortStr(txHash, 14)} <CopyText text={txHash} />
        </p>
        <button
          className="text-red-500"
          onClick={() => dismissTransaction(txHash)}
        >
          <Trash2 size={16} />
        </button>
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
