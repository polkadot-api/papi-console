import * as Dialog from "@radix-ui/react-dialog"
import { useStateObservable, withDefault } from "@react-rxjs/core"
import { Loader2, X } from "lucide-react"
import * as React from "react"
import { map } from "rxjs"
import { Transaction } from "./Transaction"
import { grouppedTransactions$, onGoingEvents } from "./transactions.state"

const txsSummary$ = grouppedTransactions$.pipeState(
  map((x) => {
    const all = [...x.values()]
    const nOngoing = all.filter((x) => onGoingEvents.has(x.type)).length
    return { nTxs: all.length, nOngoing }
  }),
  withDefault({ nTxs: 0, nOngoing: 0 }),
)

const transactionList$ = grouppedTransactions$.pipeState(
  map((x) => [...x.values()]),
  withDefault([]),
)

export function Transactions() {
  const [isOpen, setIsOpen] = React.useState(false)
  const { nTxs, nOngoing } = useStateObservable(txsSummary$)
  const list = useStateObservable(transactionList$)

  return !nTxs ? null : (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <Dialog.Trigger asChild>
        <button className="fixed bottom-4 right-4 bg-polkadot/90 text-polkadot-foreground px-4 py-2 rounded-full shadow-lg hover:bg-polkadot hover:font-bold focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-opacity-50 flex items-center space-x-2">
          {nOngoing > 0 && (
            <>
              <Loader2 className="animate-spin" size={20} />
              <span className="font-bold">{nOngoing}</span>
            </>
          )}
          <span>Transactions</span>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50" />
        <Dialog.Content className="fixed bottom-0 border-t border-x border-border right-0 w-full sm:w-96 h-96 bg-card text-card-foreground rounded-t-xl shadow-xl focus:outline-hidden">
          <div className="flex justify-between items-center p-4 border-b border-border">
            <Dialog.Title className="text-lg font-semibold">
              Transactions
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </Dialog.Close>
          </div>
          <div className="p-4 h-[calc(100%-4rem)] overflow-y-auto">
            {list.map((event) => (
              <Transaction
                key={event.txHash}
                event={event}
                onClose={() => setIsOpen(false)}
              />
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
