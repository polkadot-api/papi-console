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

export type RuntimeCallMetadataMethod = {
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
  createSignal<RuntimeCallMetadataMethod | null>()
export const selectedEntry$ = state(entryChange$, null)

export const [newRuntimeCallQuery$, addRuntimeCallQuery] = createSignal<{
  name: string
  type: number
  promise: Promise<unknown>
}>()
export const [removeRuntimeCallResult$, removeRuntimeCallResult] =
  createKeyedSignal<string>()

export type RuntimeCallResult = {
  name: string
  type: number
} & ({ result: unknown } | { error?: any })
const [getRuntimeCallSubscription$, runtimeCallKeyChange$] = partitionByKey(
  newRuntimeCallQuery$,
  () => uuid(),
  (src$, id) =>
    src$.pipe(
      switchMap(
        ({ promise, ...props }): Observable<RuntimeCallResult> =>
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
      takeUntil(removeRuntimeCallResult$(id)),
    ),
)

export const runtimeCallResultKeys$ = state(
  runtimeCallKeyChange$.pipe(
    toKeySet(),
    map((keys) => [...keys].reverse()),
  ),
  [],
)

export const runtimeCallResult$ = state(
  (key: string): Observable<RuntimeCallResult> =>
    getRuntimeCallSubscription$(key),
  null,
)
