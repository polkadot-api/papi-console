import { bytesToString } from "@/components/BinaryInput"
import { createMetadataEntryState } from "@/components/MetadataEntryInput"
import { pushWorkspaceEntry, WorkspaceEntryData } from "@/components/Workspace"
import { getHashParams } from "@/hashParams"
import {
  chainClient$,
  client$,
  runtimeCtx$,
  runtimeCtxAt$,
  selectedChainChanged$,
  unsafeApi$,
} from "@/state/chains/chain.state"
import {
  BlockInfo,
  concatMapEager,
  RuntimeContext,
} from "@polkadot-api/observable-client"
import { DefaultedStateObservable, state } from "@react-rxjs/core"
import { DatabaseSearch } from "lucide-react"
import { Binary, Enum, HexString } from "polkadot-api"
import {
  catchError,
  combineLatest,
  distinct,
  EMPTY,
  endWith,
  filter,
  firstValueFrom,
  from,
  ignoreElements,
  map,
  merge,
  mergeMap,
  Observable,
  ObservedValueOf,
  of,
  scan,
  shareReplay,
  switchMap,
  take,
  takeUntil,
} from "rxjs"
import { StorageWorkspaceEntry } from "./StorageWorkspaceEntry"
import { getEntry, getStorageItem } from "./decodeKey"

export type StorageMetadataEntry = {
  pallet: string
  entry: string
  key: number[]
  value: number
  docs: string[]
  hashers: string[]
}

const getPalletEntries = (
  ctx: Pick<RuntimeContext, "lookup" | "dynamicBuilder">,
) =>
  Object.fromEntries(
    ctx.lookup.metadata.pallets.map((p) => [
      p.name,
      p.storage?.items.map((item) => item.name) ?? [],
    ]),
  )

export const storageEntryState = createMetadataEntryState(
  getPalletEntries,
  () => {
    const params = getHashParams()
    const group = params.get("pallet") ?? "System"
    const item = params.get("entry") ?? "Account"
    return { item, group }
  },
  (ctx, entry): StorageMetadataEntry => {
    const pallet = ctx.lookup.metadata.pallets.find(
      (p) => p.name === entry.group,
    )!
    const item = pallet.storage!.items.find((i) => i.name === entry.item)!

    const { keys } = getEntry(ctx, item.type)
    const key = keys.map((v) => v.type)
    const hashers = keys.map((v) => v.hasher)

    if (item.type.tag === "plain") {
      return {
        value: item.type.value,
        key,
        pallet: pallet.name,
        entry: item.name,
        docs: item.docs,
        hashers,
      }
    }

    return {
      value: item.type.value.value,
      key,
      pallet: pallet.name,
      entry: item.name,
      docs: item.docs,
      hashers,
    }
  },
)

export type KeyCodec = {
  enc: (...args: any[]) => string
  dec: (value: string) => any[]
}
export type StorageSubscription = {
  blockHash: HexString | null
  pallet: string
  item: string
  value: Enum<{
    decode: HexString
    query: unknown[]
  }>
}

const storageSubscriptionId = (
  ctx: Pick<RuntimeContext, "dynamicBuilder" | "lookup">,
  sub: StorageSubscription,
) => {
  const item = getStorageItem(ctx, sub.pallet, sub.item)
  if (!item) {
    throw new Error(
      `Storage entry ${sub.pallet}.${sub.item} not found in context`,
    )
  }
  const entry = getEntry(ctx, item.item.type)

  return [
    sub.blockHash ?? "latest",
    sub.pallet,
    sub.item,
    sub.value.type,
    ...(sub.value.type === "decode"
      ? [sub.value.value]
      : sub.value.value.map((v, i) =>
          Binary.toHex(
            ctx.dynamicBuilder.buildDefinition(entry.keys[i].type).enc(v),
          ),
        )),
  ].join("_")
}
export const idToStorageSubscription = async (
  id: string,
): Promise<StorageSubscription> => {
  const [blockHash, pallet, item, type, ...values] = id.split("_")
  const ctx = await firstValueFrom(
    blockHash === "latest" ? runtimeCtx$ : runtimeCtxAt$(blockHash),
  )

  const storageItem = getStorageItem(ctx, pallet, item)
  if (!storageItem) {
    throw new Error(`Storage entry ${pallet}.${item} not found in context`)
  }
  const entry = getEntry(ctx, storageItem.item.type)

  return {
    blockHash: blockHash === "latest" ? null : blockHash,
    pallet,
    item,
    value:
      type === "decode"
        ? Enum("decode", values[0])
        : Enum(
            "query",
            values.map((v, i) =>
              ctx.dynamicBuilder.buildDefinition(entry.keys[i].type).dec(v),
            ),
          ),
  }
}

export const storageSubscriptionToWorkspaceEntry = async ({
  blockHash,
  pallet,
  item,
  value,
}: StorageSubscription): Promise<WorkspaceEntryData<StorageEntryContext>> => {
  const [ctx, unsafeApi] = await firstValueFrom(
    combineLatest([
      blockHash ? runtimeCtxAt$(blockHash) : runtimeCtx$,
      unsafeApi$,
    ]),
  )
  const entry = getEntry(ctx, getStorageItem(ctx, pallet, item)!.item.type)

  const storageEntry = unsafeApi.query[pallet][item]
  const name = `${pallet}.${item}`
  const args = value.type === "query" ? value.value : []
  const isEntries = value.type === "query" && args.length !== entry.keys.length

  const at = (blockHash: string) => {
    const value$ = from(
      isEntries
        ? storageEntry.getEntries(...args, {
            at: blockHash,
          })
        : storageEntry.getValue(...args, {
            at: blockHash,
          }),
    )
    const hash$ = chainClient$.pipe(
      switchMap(({ chainHead }) =>
        chainHead
          .storage$(blockHash, "hash", (ctx) =>
            ctx.dynamicBuilder.buildStorage(pallet, item).keys.enc(...args),
          )
          .pipe(map(({ value }) => value)),
      ),
    )
    const ctxType$ = runtimeCtxAt$(blockHash).pipe(
      map((ctx) => {
        const ctxEntry = getStorageItem(ctx, pallet, item)
        if (!ctxEntry) {
          throw new Error(
            `Storage entry ${pallet}.${item} not found in ${blockHash}`,
          )
        }
        const type =
          ctxEntry.item.type.tag === "plain"
            ? ctxEntry.item.type.value
            : ctxEntry.item.type.value.value

        return { ctx, type }
      }),
    )

    return combineLatest([
      combineLatest({ payload: value$, hash: hash$ }),
      ctxType$,
    ]).pipe(
      map(([a, b]) => ({ ...a, ...b })),
      take(1),
    )
  }
  const keyCodec = (hash: string) =>
    runtimeCtxAt$(hash).pipe(
      map((ctx) => ctx.dynamicBuilder.buildStorage(pallet, item).keys),
    )

  const id = storageSubscriptionId(ctx, { blockHash, pallet, item, value })
  const value$: Observable<ObservedValueOf<StorageEntryContext["status$"]>> =
    value.type === "decode"
      ? of(
          Enum("value", {
            blockHash: null,
            ctx,
            type: entry.value,
            payload: ctx.dynamicBuilder
              .buildStorage(pallet, item)
              .value.dec(value.value),
          }),
        ).pipe(
          catchError((ex) => {
            console.error(ex)
            return [Enum("error", String(ex))]
          }),
        )
      : blockHash
        ? at(blockHash).pipe(
            map((v) =>
              Enum("value", {
                blockHash,
                ...v,
              }),
            ),
            catchError((ex) => {
              console.error(ex)
              return [Enum("error", String(ex))]
            }),
          )
        : getValues$(at, isEntries, keyCodec).pipe(
            map((v) => Enum("values", v)),
          )
  const sharedValue$ = value$.pipe(
    takeUntil(selectedChainChanged$),
    shareReplay({
      bufferSize: 1,
      refCount: true,
    }),
  )

  const status$: StorageEntryContext["status$"] = state(
    sharedValue$,
    Enum("loading"),
  )
  const completed$ = state(
    sharedValue$.pipe(ignoreElements(), endWith(true)),
    false,
  )

  const context: StorageEntryContext = {
    id,
    name,
    args,
    isEntries,
    completed$,
    status$,
  }

  return {
    id,
    source: "Storage",
    link: `/storage/${id}`,
    title: context.name,
    subtitle: context.args?.map(stringifyArg).join(" "),
    icon: DatabaseSearch,
    status: context.completed$.pipe(
      map((completed) => (completed ? "done" : "live")),
    ),
    context,
    content: StorageWorkspaceEntry,
  }
}

export const addStorageSubscription = async (sub: StorageSubscription) => {
  const entry = await storageSubscriptionToWorkspaceEntry(sub)
  pushWorkspaceEntry(entry)
  return entry.id
}

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
export type StorageEntryContext = {
  id: string
  name: string
  args: unknown[] | null
  isEntries: boolean
  completed$: DefaultedStateObservable<boolean>
  status$: DefaultedStateObservable<
    Enum<{
      loading: undefined
      // Non-subscription: fetches/decodes one value, then done
      value: {
        blockHash: HexString | null
        ctx: Pick<RuntimeContext, "lookup" | "dynamicBuilder">
        type: number
        payload: unknown
      }
      // For subscriptions, adds one new value on every change
      values: Array<StorageSubscriptionValue>
      error: string
    }>
  >
}

const getValues$ = (
  at: (hash: HexString) => Observable<{
    type: number
    ctx: Pick<RuntimeContext, "lookup" | "dynamicBuilder">
    hash: HexString | null
    payload: unknown
  }>,
  isEntries: boolean,
  keyCodec?: (hash: HexString) => Observable<KeyCodec>,
): Observable<Array<StorageSubscriptionValue>> => {
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
    isEntries ? take(1) : (v) => v,
  )
  const bestResults$ = isEntries
    ? EMPTY
    : client$.pipe(
        switchMap((client) => client.bestBlocks$),
        filter((v) => v.length > 1),
        mergeMap((blocks) => blocks.slice(0, -1).reverse()),
        distinct(),
        concatMapEager((block) => queryAt$(block, false)),
      )

  const getValueHash = (value: StorageSubscriptionValue) =>
    value.result.type === "success" ? value.result.value.hash : null

  return merge(finalizedResults$, bestResults$).pipe(
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
            ...newAcc.unsettled.filter((u) => u.height < newValue.height),
            newValue,
          ]
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
}

export const stringifyArg = (value: unknown) => {
  if (typeof value === "object" && value !== null) {
    return value instanceof Uint8Array ? bytesToString(value) : "arg"
  }
  return String(value)
}
