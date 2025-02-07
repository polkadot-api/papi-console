import { chainClient$ } from "@/state/chains/chain.state"
import { state } from "@react-rxjs/core"
import {
  combineKeys,
  createSignal,
  mergeWithKey,
  partitionByKey,
} from "@react-rxjs/utils"
import { HexString, InvalidTxError, TxBroadcastEvent } from "polkadot-api"
import {
  catchError,
  filter,
  merge,
  mergeMap,
  Observable,
  of,
  skip,
  takeUntil,
  tap,
  withLatestFrom,
} from "rxjs"

const [signedTx$, trackSignedTx] = createSignal<HexString>()
const [unsignedTx$, trackUnsignedTx] = createSignal<HexString>()
export { trackSignedTx, trackUnsignedTx }

export const [dismissTransaction$, dismissTransaction] = createSignal<string>()

const transactions$ = mergeWithKey({ signedTx$, unsignedTx$ }).pipe(
  withLatestFrom(chainClient$),
  mergeMap(([tx, { client }]) => {
    const submitAndWatch = client.submitAndWatch as (
      tx: HexString,
      at: string,
      withSigned?: boolean,
    ) => Observable<TxBroadcastEvent>

    let txHash: string = ""
    return submitAndWatch(tx.payload, "finalized", true).pipe(
      tap((e) => {
        txHash = e.txHash
      }),
      catchError((err) =>
        of({
          type:
            err instanceof InvalidTxError
              ? ("invalid" as const)
              : ("error" as const),
          txHash,
          value: err,
        }),
      ),
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
