import {
  forklift,
  Forklift,
  fromWorker,
  wsSource,
} from "@polkadot-api/forklift"
import Worker from "@polkadot-api/forklift/worker?worker"
import { Binary, type JsonRpcProvider } from "polkadot-api"
import {
  BehaviorSubject,
  catchError,
  map,
  Observable,
  startWith,
  switchMap,
  take,
  toArray,
  withLatestFrom,
} from "rxjs"
import type { BlockDiff } from "./block.state"
import { chainClient$ } from "./chains/chain.state"

const forkliftInstance$ = new BehaviorSubject<Forklift | null>(null)

export const createForkliftProvider = (
  endpoint: string | string[],
): JsonRpcProvider => {
  return (onMsg) => {
    const worker = new Worker()
    const instance = forklift(wsSource(endpoint), {
      mockSignatureHost: true,
      executor: fromWorker(worker),
    })
    forkliftInstance$.next(instance)
    const connection = instance.serve(onMsg)

    return {
      send: connection.send,
      disconnect() {
        forkliftInstance$.next(null)
        connection.disconnect()
        instance.destroy()
        worker.terminate()
      },
    }
  }
}

export const getForkliftBlockDiff$ = (
  parent: string,
  hash: string,
): Observable<BlockDiff | null> =>
  forkliftInstance$.pipe(
    take(1),
    switchMap((chain) => (chain ? chain.getStorageDiff(hash) : [null])),
    startWith(null),
    withLatestFrom(chainClient$),
    switchMap(([diff, { chainHead }]) => {
      if (!diff) return [null]

      const missingPrevValues = Object.entries(diff).filter(
        ([_, { prev }]) => prev === undefined,
      )

      return chainHead
        .storageQueries$(
          parent,
          missingPrevValues.map(([key]) => ({ key, type: "value" })),
        )
        .pipe(
          toArray(),
          map((v) => ({
            ...(diff as BlockDiff),
            ...Object.fromEntries(
              v.map((v) => [
                v.key,
                {
                  value: diff[v.key].value,
                  prev: v.value == null ? null : Binary.fromHex(v.value),
                },
              ]),
            ),
          })),
          catchError(() => [diff as BlockDiff]),
        )
    }),
    catchError((ex) => {
      console.error(ex)
      return [null]
    }),
  )
