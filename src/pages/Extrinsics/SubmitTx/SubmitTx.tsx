import { ActionButton } from "@/components/ActionButton"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { toHex } from "@polkadot-api/utils"
import { HexString } from "polkadot-api"
import React, { lazy, Suspense, useState } from "react"

const SendTransactionForm = lazy(() => import("./SubmitTxForm"))

export const ExtrinsicModal: React.FC<{
  callData: Uint8Array | HexString | undefined
}> = ({ callData }) => {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <ActionButton disabled={callData == null || callData.length === 0}>
          Submit extrinsic
        </ActionButton>
      </DialogTrigger>
      <DialogContent
        onInteractOutside={(evt) => {
          if (
            evt.target instanceof HTMLElement &&
            evt.target.tagName === "WCM-MODAL"
          )
            evt.preventDefault()
        }}
        className="flex flex-col overflow-hidden"
      >
        <DialogTitle>Create TX</DialogTitle>
        <Suspense fallback="Loading…">
          <SendTransactionForm
            callData={
              callData instanceof Uint8Array ? toHex(callData) : callData!
            }
            onClose={() => setOpen(false)}
          />
        </Suspense>
      </DialogContent>
    </Dialog>
  )
}
