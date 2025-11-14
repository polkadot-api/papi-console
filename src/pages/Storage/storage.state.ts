import { bytesToString } from "@/components/BinaryInput"
import { getHashParams } from "@/hashParams"
import { client$, selectedChainChanged$ } from "@/state/chains/chain.state"
import { BlockInfo, RuntimeContext } from "@polkadot-api/observable-client"
import { state } from "@react-rxjs/core"
import {
  createKeyedSignal,
  createSignal,
  mergeWithKey,
  partitionByKey,
  toKeySet,
} from "@react-rxjs/utils"
import { Binary, Enum, HexString } from "polkadot-api"
import {
  catchError,
  combineLatest,
  combineLatestWith,
  concat,
  EMPTY,
  filter,
  ignoreElements,
  map,
  merge,
  mergeMap,
  Observable,
  of,
  scan,
  shareReplay,
  startWith,
  switchMap,
  take,
  takeUntil,
  withLatestFrom,
} from "rxjs"
import { v4 as uuid } from "uuid"
import { selectedBlock$ } from "./BlockPicker"

export type StorageMetadataEntry = {
  pallet: string
  entry: string
  key: number[]
  value: number
  docs: string[]
  hashers: string[]
}

export const [entryChange$, selectEntry] = createSignal<{
  pallet?: string | null
  entry?: string | null
}>()

const palletEntries$ = selectedBlock$.pipe(
  map(({ ctx }) =>
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
    combineLatestWith(palletEntries$),
    scan(
      (acc, [evt, pallets]) => {
        const newValue =
          evt.type === "entryChange$"
            ? { ...acc, ...evt.payload }
            : {
                pallet: acc.pallet ?? evt.payload.pallet,
                entry: acc.entry ?? evt.payload.entry,
              }
        let selectedPallet = newValue.pallet ? pallets[newValue.pallet] : null
        if (!selectedPallet) {
          newValue.pallet = Object.keys(pallets)[0] ?? null
          selectedPallet = pallets[newValue.pallet] ?? null
        }
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
  combineLatest([partialEntry$, selectedBlock$]).pipe(
    withLatestFrom(palletEntries$),
    map(([[partialEntry, { ctx }], entries]): StorageMetadataEntry | null => {
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
          hashers: [],
        }
      }

      const hashers = type.value.hashers.map((x) => x.tag)
      if (hashers.length === 1) {
        return {
          value: type.value.value,
          key: [type.value.key],
          pallet,
          entry: entry.name,
          docs,
          hashers,
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
        hashers,
      }
    }),
  ),
  null,
)

export type KeyCodec = {
  enc: (...args: any[]) => string
  dec: (value: string) => any[]
}
export const [newStorageSubscription$, addStorageSubscription] = createSignal<{
  name: string
  args: unknown[] | null
  single: boolean
  keyCodec?: (hash: HexString) => Observable<KeyCodec>
  at?: (hash: HexString) => Observable<{
    type: number
    ctx: Pick<RuntimeContext, "lookup" | "dynamicBuilder">
    hash: HexString | null
    payload: unknown
  }>
  value?: Observable<{
    type: number
    ctx: Pick<RuntimeContext, "lookup" | "dynamicBuilder">
    hash: string | null
    payload: unknown
  }>
}>()
export const [removeStorageSubscription$, removeStorageSubscription] =
  createKeyedSignal<string>()
export const [stopStorageSubscription$, stopStorageSubscription] =
  createKeyedSignal<string>()

export type StorageSubscriptionValue = {
  height: number
  blockHash: HexString
  settled: boolean
  keyCodec?: KeyCodec
  result: Enum<{
    success: {
      hash: string | null
      ctx: Pick<RuntimeContext, "lookup" | "dynamicBuilder">
      type: number
      payload: unknown
    }
    error: string
  }>
}
export type StorageSubscription = {
  name: string
  args: unknown[] | null
  single: boolean
  completed: boolean
  status: Enum<{
    loading: undefined
    value: {
      hash: string | null
      ctx: Pick<RuntimeContext, "lookup" | "dynamicBuilder">
      type: number
      payload: unknown
    }
    values: Array<StorageSubscriptionValue>
  }>
}

const getStatus$ = (
  at: (hash: HexString) => Observable<{
    type: number
    ctx: Pick<RuntimeContext, "lookup" | "dynamicBuilder">
    hash: HexString | null
    payload: unknown
  }>,
  single: boolean,
  keyCodec?: (hash: HexString) => Observable<KeyCodec>,
): Observable<StorageSubscription["status"]> => {
  const queryAt$ = (
    block: BlockInfo,
    settled: boolean,
  ): Observable<StorageSubscriptionValue> =>
    combineLatest([
      at(block.hash),
      keyCodec?.(block.hash) ?? of(undefined),
    ]).pipe(
      take(1),
      map(([payload, keyCodec]) => ({
        height: block.number,
        blockHash: block.hash,
        settled,
        keyCodec,
        result: Enum("success", payload),
      })),
      catchError((ex) => [
        {
          height: block.number,
          blockHash: block.hash,
          settled,
          result: Enum("error", String(ex)),
        },
      ]),
    )
  const finalizedResults$ = client$.pipe(
    switchMap((client) => client.finalizedBlock$),
    mergeMap((block) => queryAt$(block, true)),
    // Not supporting watchEntries for now. In case it's querying entries, we only take one
    single ? (v) => v : take(1),
  )
  const bestResults$ = single
    ? client$.pipe(
        switchMap((client) => client.bestBlocks$),
        filter((v) => v.length > 1),
        map((blocks) => blocks[0]),
        mergeMap((block) => queryAt$(block, false)),
      )
    : EMPTY

  const getValueHash = (value: StorageSubscriptionValue) =>
    value.result.type === "success" ? value.result.value.hash : null

  const values$ = merge(finalizedResults$, bestResults$).pipe(
    scan(
      (
        acc: {
          settled: StorageSubscriptionValue[]
          settledHashes: Record<string, number>
          unsettled: StorageSubscriptionValue[]
        },
        newValue,
      ) => {
        const newAcc = { ...acc }

        if (newValue.settled) {
          const valueHash = getValueHash(newValue)
          if (valueHash && newAcc.settledHashes[valueHash] != null) {
            const prevHeight = newAcc.settledHashes[valueHash]
            if (prevHeight > newValue.height) {
              newAcc.settledHashes = {
                ...newAcc.settledHashes,
                [valueHash]: newValue.height,
              }
              newAcc.settled = newAcc.settled.map((prevSettled) => {
                const hash = getValueHash(prevSettled)
                return hash === valueHash ? newValue : prevSettled
              })
            }
          } else {
            newAcc.settled = [...newAcc.settled, newValue]
            newAcc.settled.sort((a, b) => a.height - b.height)
            if (valueHash) {
              newAcc.settledHashes = {
                ...newAcc.settledHashes,
                [valueHash]: newValue.height,
              }
            }
          }
          // Remove all unsettled blocks behind new finalized
          newAcc.unsettled = newAcc.unsettled.filter(
            (u) => u.height > newValue.height,
          )
        } else {
          // Remove all unsettled blocks above the new unsettled one
          const res = [
            ...newAcc.unsettled.filter((u) => u.height > newValue.height),
            newValue,
          ]
          res.sort((a, b) => a.height - b.height)
          // Prune duplicate values by hash
          newAcc.unsettled = []
          let prevHash: string | null = null
          for (let i = 0; i < res.length; i++) {
            const hash = getValueHash(res[i])
            if (res[i].result.type === "error" || hash !== prevHash) {
              newAcc.unsettled.push(res[i])
              prevHash = hash
            }
          }
        }

        return newAcc
      },
      { settled: [], settledHashes: {}, unsettled: [] },
    ),
    map(({ settled, settledHashes, unsettled }) => [
      ...settled,
      ...unsettled.filter((v) => {
        const hash = getValueHash(v)
        // TODO edge case of a finalized value changing in one best block, then resetting on the next one
        return !hash || settledHashes[hash] == null
      }),
    ]),
  )

  return values$.pipe(map((values) => Enum("values", values)))
}

const [getStorageSubscription$, storageSubscriptionKeyChange$] = partitionByKey(
  newStorageSubscription$,
  () => uuid(),
  (src$, id) =>
    src$.pipe(
      switchMap(
        ({
          at,
          value,
          keyCodec,
          ...props
        }): Observable<StorageSubscription> => {
          const status$: Observable<StorageSubscription["status"]> = value
            ? value.pipe(map((v) => Enum("value", v)))
            : getStatus$(at!, props.single, keyCodec)
          const result$ = status$.pipe(
            map((status) => ({
              ...props,
              status,
            })),
            startWith({
              ...props,
              status: Enum("loading"),
            }),
            shareReplay(1),
            takeUntil(stopStorageSubscription$(id)),
          )
          const completed$ = concat(
            of(false),
            result$.pipe(ignoreElements()),
            of(true),
          )
          return combineLatest([completed$, result$]).pipe(
            map(([completed, result]) => ({
              ...result,
              completed,
            })),
          )
        },
      ),
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
    getStorageSubscription$(key),
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
