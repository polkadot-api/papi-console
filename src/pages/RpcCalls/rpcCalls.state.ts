import { state } from "@react-rxjs/core"
import {
  createKeyedSignal,
  createSignal,
  partitionByKey,
  toKeySet,
} from "@react-rxjs/utils"
import {
  catchError,
  from,
  map,
  Observable,
  of,
  startWith,
  switchMap,
  takeUntil,
} from "rxjs"
import { v4 as uuid } from "uuid"

export type RpcCallMetadataMethod = {
  api: string
  name: string
  inputs: {
    name: string
    type: number
  }[]
  output: number
  docs: string[]
}

export const [entryChange$, setSelectedMethod] =
  createSignal<RpcCallMetadataMethod | null>()
export const selectedEntry$ = state(entryChange$, null)

export const [newRpcCallQuery$, addRpcCallQuery] = createSignal<{
  method: string
  payload: string
  promise: Promise<unknown>
}>()
export const [removeRpcCallResult$, removeRpcCallResult] =
  createKeyedSignal<string>()

export type RpcCallResult = {
  method: string
  payload: string
} & ({ result: unknown } | { error?: any })
const [getRpcCallSubscription$, rpcCallKeyChange$] = partitionByKey(
  newRpcCallQuery$,
  () => uuid(),
  (src$, id) =>
    src$.pipe(
      switchMap(
        ({ promise, ...props }): Observable<RpcCallResult> =>
          from(promise).pipe(
            map((result) => ({
              ...props,
              result,
            })),
            catchError((ex) => {
              console.error(ex)
              return of({
                ...props,
                error: ex,
              })
            }),
            startWith(props),
          ),
      ),
      takeUntil(removeRpcCallResult$(id)),
    ),
)

export const rpcCallResultKeys$ = state(
  rpcCallKeyChange$.pipe(
    toKeySet(),
    map((keys) => [...keys].reverse()),
  ),
  [],
)

export const rpcCallResult$ = state(
  (key: string): Observable<RpcCallResult> => getRpcCallSubscription$(key),
  null,
)
