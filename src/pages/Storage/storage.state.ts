import { bytesToString } from "@/components/BinaryInput"
import { getHashParams } from "@/hashParams"
import { runtimeCtx$, selectedChainChanged$ } from "@/state/chains/chain.state"
import { state } from "@react-rxjs/core"
import {
  createKeyedSignal,
  createSignal,
  mergeWithKey,
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
  withLatestFrom,
} from "rxjs"
import { v4 as uuid } from "uuid"

export type StorageMetadataEntry = {
  pallet: string
  entry: string
  key: number[]
  value: number
  docs: string[]
}

export const [entryChange$, selectEntry] = createSignal<{
  pallet?: string | null
  entry?: string | null
}>()

const palletEntries$ = runtimeCtx$.pipe(
  map((ctx) =>
    Object.fromEntries(
      ctx.lookup.metadata.pallets.map((p) => [p.name, p.storage?.items ?? []]),
    ),
  ),
)

const initialValue$ = palletEntries$.pipe(
  map(() => {
    const params = getHashParams()
    const pallet = params.get("pallet") ?? "System"
    const entry = params.get("entry") ?? "Account"
    return { entry, pallet }
  }),
)

export const partialEntry$ = state(
  mergeWithKey({ entryChange$, initialValue$ }).pipe(
    withLatestFrom(palletEntries$),
    scan(
      (acc, [evt, pallets]) => {
        const newValue =
          evt.type === "entryChange$"
            ? { ...acc, ...evt.payload }
            : {
                pallet: acc.pallet ?? evt.payload.pallet,
                entry: acc.entry ?? evt.payload.entry,
              }
        const selectedPallet = newValue.pallet ? pallets[newValue.pallet] : null
        if (!selectedPallet?.find((it) => it.name === newValue.entry)) {
          newValue.entry = selectedPallet?.[0]?.name ?? null
        }
        return newValue
      },
      {
        pallet: null as string | null,
        entry: null as string | null,
      },
    ),
  ),
  {
    pallet: null,
    entry: null,
  },
)

export const selectedEntry$ = state(
  partialEntry$.pipe(
    withLatestFrom(palletEntries$, runtimeCtx$),
    map(([partialEntry, entries, ctx]): StorageMetadataEntry | null => {
      const entry = partialEntry.pallet
        ? entries[partialEntry.pallet]?.find(
            (v) => v.name === partialEntry.entry,
          )
        : null
      if (!entry?.type) return null

      const { type, docs } = entry
      const pallet = partialEntry.pallet!

      if (type.tag === "plain") {
        return {
          value: type.value,
          key: [],
          pallet,
          entry: entry.name,
          docs,
        }
      }

      if (type.value.hashers.length === 1) {
        return {
          value: type.value.value,
          key: [type.value.key],
          pallet,
          entry: entry.name,
          docs,
        }
      }

      const keyDef = ctx.lookup(type.value.key)
      const key = (() => {
        if (keyDef.type === "array") {
          return new Array(keyDef.len).fill(keyDef.value.id)
        }
        if (keyDef.type === "tuple") {
          return keyDef.value.map((e) => e.id)
        }
        throw new Error("Invalid key type " + keyDef.type)
      })()
      return {
        key,
        value: type.value.value,
        pallet,
        entry: entry.name,
        docs,
      }
    }),
  ),
  null,
)

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
  return String(value)
}
