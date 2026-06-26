import { forkliftInstance$ } from "@/state/forklift"
import { chainClient$, client$ } from "@/state/chains/chain.state"
import { SystemEvent } from "@polkadot-api/observable-client"
import { Binary, blockHeader, SizedHex } from "@polkadot-api/substrate-bindings"
import { liftSuspense, state, SUSPENSE } from "@react-rxjs/core"
import { combineKeys, partitionByKey } from "@react-rxjs/utils"
import {
  BlockHeader,
  HexString,
  PolkadotClient,
  BlockInfo as RawBlockInfo,
} from "polkadot-api"
import { fromHex } from "polkadot-api/utils"
import { createContext } from "react"
import {
  catchError,
  combineLatest,
  combineLatestWith,
  defer,
  EMPTY,
  filter,
  forkJoin,
  from,
  map,
  merge,
  mergeMap,
  Observable,
  of,
  pipe,
  repeat,
  retry,
  scan,
  share,
  startWith,
  Subject,
  switchMap,
  take,
  takeWhile,
  tap,
  toArray,
  withLatestFrom,
} from "rxjs"

export const finalized$ = client$.pipeState(
  switchMap((client) => client.finalizedBlock$),
)

export enum BlockState {
  Fork = "fork",
  Best = "best",
  Finalized = "finalized",
  Pruned = "pruned",
  Unknown = "unknown",
}
export type BlockDiff = Record<
  string,
  {
    value: Uint8Array | null
    prev: Uint8Array | null
  }
>
export interface BlockInfo {
  hash: string
  parent: string
  number: number
  body: Uint8Array[] | null
  events: SystemEvent[] | null
  header: BlockHeader | null
  status: BlockState
  diff: BlockDiff | null
}
export const BlockContext = createContext<BlockInfo | null>(null)

const finalizedBlocks$ = state(
  client$.pipe(
    switchMap((client) => {
      const data = new Map<string, number>()
      return client.finalizedBlock$.pipe(
        scan((acc, current: { hash: string; number: number }) => {
          acc.set(current.hash, current.number)
          return acc
        }, data),
        startWith(data),
      )
    }),
  ),
)
finalizedBlocks$.pipe(liftSuspense(), retry()).subscribe()

const MAX_HEIGHT = 600
const sharedBlocks$ = client$.pipe(
  liftSuspense(),
  switchMap((client) => (client === SUSPENSE ? [] : client.blocks$)),
  share(),
)
export const [blockInfo$, recordedBlocks$] = partitionByKey(
  sharedBlocks$,
  (v) => v.hash,
  (block$) =>
    combineLatest([block$.pipe(take(1)), client$.pipe(liftSuspense())]).pipe(
      switchMap(
        ([{ hash, parent, number }, client]): Observable<BlockInfo | null> => {
          // When client is being changed for another, remove all blocks
          if (client === SUSPENSE) return of(null)

          const blockInfo$: Observable<BlockInfo> = combineLatest({
            hash: of(hash),
            parent: of(parent),
            number: of(number),
            body: client.getBlockBody$(hash).pipe(
              startWith(null),
              catchError((err) => {
                console.error("fetch body failed", err)
                return of(null)
              }),
            ),
            events: from(
              client.getUnsafeApi().query.System.Events.getValue({
                at: hash,
              }) as Promise<SystemEvent[]>,
            ).pipe(
              startWith(null),
              catchError((err) => {
                console.error("fetch events failed", err)
                return of(null)
              }),
            ),
            header: from(client.getBlockHeader(hash)).pipe(
              startWith(null),
              catchError((err) => {
                console.error("fetch header failed", err)
                return of(null)
              }),
            ),
            status: getBlockStatus$(client, hash, number, parent),
            diff: getBlockDiff$(parent, hash),
          })

          const resetWhenOld$ = sharedBlocks$.pipe(
            filter((b) => b.number >= number + MAX_HEIGHT),
            map(() => null),
          )

          return merge(
            blockInfo$.pipe(
              tap({
                error: (ex) => console.log("blockInfo", ex),
              }),
            ),
            resetWhenOld$.pipe(
              tap({
                error: (ex) => console.log("resetWhenOld", ex),
              }),
            ),
          )
        },
      ),
      takeWhile((v) => v !== null),
      // SUSPENSE doesn't play out well with partitionByKey: it crashes the whole observable
      filterOutSuspense(),
    ),
)

const getUnpinnedBlockInfo$ = (hash: string): Observable<BlockInfo> =>
  client$.pipe(
    switchMap((client) =>
      combineLatest({
        headerAndStatus: from(client.getBlockHeader(hash)).pipe(
          mergeMap((header) =>
            getBlockStatus$(
              client,
              hash,
              header.number,
              header.parentHash,
            ).pipe(
              map((status) => ({
                header,
                status,
              })),
            ),
          ),
        ),
        body: client.getBlockBody$(hash),
        events: client.getUnsafeApi().query.System.Events.getValue({
          at: hash,
        }) as Promise<SystemEvent[]>,
      }).pipe(
        map(({ headerAndStatus: { header, status }, body, events }) => ({
          hash: hash,
          parent: header.parentHash,
          number: header.number,
          body,
          events,
          header,
          status,
          diff: null,
        })),
        catchError(() => getUnpinnedBlockInfoFallback$(hash, client)),
        tap((v) => disconnectedBlocks$.next(v)),
      ),
    ),
  )

const digestCodec = blockHeader.inner.digests.inner
const getUnpinnedBlockInfoFallback$ = (
  hash: string,
  client: PolkadotClient,
): Observable<BlockInfo> => {
  const throughRpc$ = defer(() =>
    client._request<
      {
        block: {
          extrinsics: HexString[]
          header: {
            digest: { logs: Array<string> }
            extrinsicsRoot: string
            number: HexString
            parentHash: HexString
            stateRoot: HexString
          }
        }
      } | null,
      [string]
    >("chain_getBlock", [hash]),
  ).pipe(
    repeat({
      delay: 1000,
    }),
    filter((v) => !!v),
    take(1),
    catchError(() => EMPTY),
    mergeMap((res) => {
      const header = res.block.header
      const number = Number(header.number)
      return getBlockStatus$(client, hash, number, header.parentHash).pipe(
        map((status) => ({
          ...res,
          number,
          status,
        })),
      )
    }),
  )

  return throughRpc$.pipe(
    map(
      ({ block: { extrinsics, header }, status, number }): BlockInfo => ({
        hash,
        parent: header.parentHash,
        body: extrinsics.map(fromHex),
        events: null,
        header: {
          digests: header.digest.logs
            .map((log) => {
              try {
                return digestCodec.dec(log)
              } catch (ex) {
                console.error(ex)
                return null
              }
            })
            .filter((v) => v != null),
          extrinsicRoot: header.extrinsicsRoot,
          number,
          parentHash: header.parentHash,
          stateRoot: header.stateRoot,
        },
        number,
        status,
        diff: null,
      }),
    ),
  )
}

export const inMemoryBlocks$ = state(
  combineKeys(recordedBlocks$, (key) =>
    blockInfo$(key).pipe(startWith(null)),
  ).pipe(repeat()),
)
inMemoryBlocks$.pipe(liftSuspense()).subscribe()

export const blockHash$ = (hashOrHeight: string): Observable<SizedHex<32>> =>
  hashOrHeight.length > 63
    ? of(hashOrHeight.startsWith("0x") ? hashOrHeight : `0x${hashOrHeight}`)
    : client$.pipe(
        switchMap((client) =>
          from(
            client._request<HexString[], [number]>("archive_v1_hashByHeight", [
              Number(hashOrHeight),
            ]),
          ).pipe(
            map((x) => {
              if (x.length) return x[0]
              throw null
            }),
            catchError(
              () =>
                client
                  .getUnsafeApi()
                  .query.System.BlockHash.getValue(
                    Number(hashOrHeight),
                  ) as Promise<SizedHex<32>>,
            ),
          ),
        ),
        liftSuspense(),
        filter((v) => v != SUSPENSE),
        take(1),
      )

export const blockInfoState$ = state(
  (hashOrHeight: string) =>
    inMemoryBlocks$.pipe(
      take(1),
      switchMap((blocks) => {
        if (blocks.has(hashOrHeight)) return blockInfo$(hashOrHeight)
        const potentialHeight = Number(hashOrHeight)
        const target = Array.from(blocks.values()).find(
          (x) => x?.number === potentialHeight,
        )
        if (target) return blockInfo$(target.hash)
        return blockHash$(hashOrHeight).pipe(mergeMap(getUnpinnedBlockInfo$))
      }),
    ),
  null,
)

const disconnectedBlocks$ = new Subject<BlockInfo>()
export const blocksByHeight$ = state(
  merge(
    recordedBlocks$.pipe(
      mergeMap((change) => {
        if (change.type === "remove") {
          return of({
            type: "remove" as const,
            keys: change.keys,
          })
        }
        const targets$ = forkJoin(
          [...change.keys].map((hash) => blockInfo$(hash).pipe(take(1))),
        )

        return targets$.pipe(
          map((targets) => ({
            type: "add" as const,
            targets,
          })),
        )
      }),
    ),
    disconnectedBlocks$.pipe(
      map((block) => ({
        type: "add" as const,
        targets: [block],
      })),
    ),
  ).pipe(
    scan(
      (acc, evt) => {
        if (evt.type === "remove") {
          for (const hash of evt.keys) {
            const height = acc.heightOfBlock[hash]
            acc.blocksByHeight[height]?.delete(hash)
            if (!acc.blocksByHeight[height]?.size) {
              delete acc.blocksByHeight[height]
            }
            delete acc.heightOfBlock[hash]
          }
        } else {
          for (const block of evt.targets) {
            acc.heightOfBlock[block.hash] = block.number
            acc.blocksByHeight[block.number] =
              acc.blocksByHeight[block.number] ?? new Map()
            acc.blocksByHeight[block.number].set(block.hash, block)
          }
        }

        return acc
      },
      {
        blocksByHeight: {} as Record<number, Map<string, BlockInfo>>,
        heightOfBlock: {} as Record<string, number>,
      },
    ),
    map((v) => v.blocksByHeight),
  ),
)

const getBlockStatus = (
  best: Array<RawBlockInfo>,
  finBlocks: Map<string, number>,
  number: number,
  hash: string,
) => {
  const finalized = best[best.length - 1]
  if (finalized.number === number)
    return finalized.hash === hash ? BlockState.Finalized : BlockState.Pruned

  return finalized.number < number
    ? best.some((b) => b.hash === hash)
      ? BlockState.Best
      : BlockState.Fork
    : finBlocks.has(hash)
      ? BlockState.Finalized
      : BlockState.Unknown
}

const filterOutSuspense = <T>() =>
  pipe(
    liftSuspense<T>(),
    filter((v): v is T => v !== SUSPENSE),
  )

const getBlockStatus$ = (
  client: PolkadotClient,
  hash: string,
  number: number,
  parent: string,
): Observable<BlockState> =>
  client.bestBlocks$.pipe(
    combineLatestWith(finalizedBlocks$.pipe(filterOutSuspense())),
    map(([best, finBlocks]) => {
      const status = getBlockStatus(best, finBlocks, number, hash)
      if (status === BlockState.Finalized && !finBlocks.has(parent))
        finBlocks.set(parent, number - 1)
      return status
    }),
    takeWhile(
      (v) => v !== BlockState.Finalized && v !== BlockState.Pruned,
      true,
    ),
  )

const getBlockDiff$ = (
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
