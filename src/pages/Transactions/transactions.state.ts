import { chainClient$ } from "@/state/chains/chain.state"
import { state } from "@react-rxjs/core"
import {
  combineKeys,
  createSignal,
  mergeWithKey,
  partitionByKey,
} from "@react-rxjs/utils"
import { InvalidTxError } from "polkadot-api"
import {
  catchError,
  filter,
  merge,
  mergeMap,
  of,
  skip,
  takeUntil,
  tap,
  withLatestFrom,
} from "rxjs"

const [signedTx$, trackSignedTx] = createSignal<Uint8Array>()
const [unsignedTx$, trackUnsignedTx] = createSignal<Uint8Array>()
export { trackSignedTx, trackUnsignedTx }

export const [dismissTransaction$, dismissTransaction] = createSignal<string>()

const transactions$ = mergeWithKey({ signedTx$, unsignedTx$ }).pipe(
  withLatestFrom(chainClient$),
  mergeMap(([tx, { client }]) => {
    let txHash: string = ""
    return client.submitAndWatch(tx.payload, "finalized").pipe(
      tap((e) => {
        txHash = e.txHash
      }),
      catchError((err) => {
        console.log(err)
        console.log(tx.payload, client.getFinalizedBlock())

        return of({
          type:
            err instanceof InvalidTxError
              ? ("invalid" as const)
              : ("error" as const),
          txHash,
          value: err,
        })
      }),
      takeUntil(dismissTransaction$.pipe(filter((v) => v === txHash))),
    )
  }),
)

const [tx$, txKeys$] = partitionByKey(
  transactions$,
  (x) => x.txHash,
  (x, hash) =>
    x.pipe(
      takeUntil(
        merge(
          chainClient$.pipe(skip(1)),
          dismissTransaction$.pipe(filter((v) => v === hash)),
        ),
      ),
    ),
)

export const grouppedTransactions$ = state(combineKeys(txKeys$, tx$))
export const onGoingEvents = new Set([
  "signed",
  "broadcasted",
  "txBestBlocksState",
])
