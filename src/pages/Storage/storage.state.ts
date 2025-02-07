import { bytesToString } from "@/components/BinaryInput"
import { selectedChainChanged$ } from "@/state/chains/chain.state"
import { state } from "@react-rxjs/core"
import {
  createKeyedSignal,
  createSignal,
  partitionByKey,
  toKeySet,
} from "@react-rxjs/utils"
import { Binary } from "polkadot-api"
import {
  combineLatest,
  concat,
  distinctUntilChanged,
  ignoreElements,
  map,
  merge,
  Observable,
  of,
  scan,
  shareReplay,
  startWith,
  switchMap,
  takeUntil,
} from "rxjs"
import { v4 as uuid } from "uuid"

export type StorageMetadataEntry = {
  pallet: string
  entry: string
  key: number[]
  value: number
  docs: string[]
}

export const [entryChange$, setSelectedEntry] =
  createSignal<StorageMetadataEntry | null>()
export const selectedEntry$ = state(entryChange$, null)

export const [newStorageSubscription$, addStorageSubscription] = createSignal<{
  name: string
  args: unknown[] | null
  type: number
  single: boolean
  stream: Observable<unknown>
}>()
export const [removeStorageSubscription$, removeStorageSubscription] =
  createKeyedSignal<string>()
export const [togglePause$, toggleSubscriptionPause] =
  createKeyedSignal<string>()

export type StorageSubscription = {
  name: string
  args: unknown[] | null
  type: number
  single: boolean
  paused: boolean
  completed: boolean
} & ({ result: unknown } | {})
const [getStorageSubscription$, storageSubscriptionKeyChange$] = partitionByKey(
  newStorageSubscription$,
  () => uuid(),
  (src$, id) =>
    src$.pipe(
      switchMap(({ stream, ...props }): Observable<StorageSubscription> => {
        const paused$ = togglePause$(id).pipe(
          scan((v) => !v, false),
          startWith(false),
        )
        const result$ = stream.pipe(
          map((result) => ({
            ...props,
            result,
          })),
          startWith(props),
          shareReplay(1),
        )
        const completed$ = concat(
          of(false),
          result$.pipe(ignoreElements()),
          of(true),
        )
        return combineLatest([paused$, completed$, result$]).pipe(
          map(([paused, completed, result]) => ({
            ...result,
            paused,
            completed,
          })),
        )
      }),
      takeUntil(merge(removeStorageSubscription$(id), selectedChainChanged$)),
    ),
)

export const storageSubscriptionKeys$ = state(
  storageSubscriptionKeyChange$.pipe(
    toKeySet(),
    map((keys) => [...keys].reverse()),
  ),
  [],
)
export const storage$ = storageSubscriptionKeys$

export const storageSubscription$ = state(
  (key: string): Observable<StorageSubscription> =>
    getStorageSubscription$(key).pipe(
      // Don't propagate if paused
      distinctUntilChanged((prev, current) => {
        // if it's not paused, mark it as "not equal" for the update to go through
        if (!current.paused) return false
        // otherwise, don't propagate if we were previously paused
        // but do propagate if we weren't: Because we still need to show the "paused" status.
        return prev.paused === current.paused
      }),
    ),
  null,
)

export const stringifyArg = (value: unknown) => {
  if (typeof value === "object" && value !== null) {
    if (value instanceof Binary) {
      return bytesToString(value)
    }
    return "arg"
  }
  return JSON.stringify(value)
}
