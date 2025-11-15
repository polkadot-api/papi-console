import { UnifiedMetadata } from "@polkadot-api/substrate-bindings"
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

type Pallet = UnifiedMetadata["pallets"][number]
export type ViewFnEntry = Pallet["viewFns"][number] & {
  pallet: string
}

export const [entryChange$, setSelectedFn] = createSignal<ViewFnEntry | null>()
export const selectedEntry$ = state(entryChange$, null)

export const [newViewFnCall$, addViewFnCall] = createSignal<{
  name: string
  type: number
  promise: Promise<unknown>
}>()
export const [removeViewFnResult$, removeViewFnResult] =
  createKeyedSignal<string>()

export type ViewFnResult = {
  name: string
  type: number
} & ({ result: unknown } | { error?: any })
const [getViewFnSubscription$, viewFnKeyChange$] = partitionByKey(
  newViewFnCall$,
  () => uuid(),
  (src$, id) =>
    src$.pipe(
      switchMap(
        ({ promise, ...props }): Observable<ViewFnResult> =>
          from(promise).pipe(
            map((result) => ({
              ...props,
              result,
              paused: false,
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
      takeUntil(removeViewFnResult$(id)),
    ),
)

export const viewFnResultKeys$ = state(
  viewFnKeyChange$.pipe(
    toKeySet(),
    map((keys) => [...keys].reverse()),
  ),
  [],
)

export const viewFnResult$ = state(
  (key: string): Observable<ViewFnResult> => getViewFnSubscription$(key),
  null,
)
