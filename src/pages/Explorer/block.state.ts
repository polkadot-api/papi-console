import { chopsticksInstance$ } from "@/chopsticks/chopsticks"
import { chainClient$, client$ } from "@/state/chains/chain.state"
import { SystemEvent } from "@polkadot-api/observable-client"
import { state } from "@react-rxjs/core"
import { combineKeys, partitionByKey } from "@react-rxjs/utils"
import { FixedSizeBinary, HexString, PolkadotClient } from "polkadot-api"
import {
  catchError,
  combineLatest,
  concat,
  defer,
  EMPTY,
  filter,
  forkJoin,
  from,
  map,
  merge,
  mergeMap,
  NEVER,
  Observable,
  of,
  repeat,
  scan,
  skip,
  startWith,
  Subject,
  switchMap,
  take,
  takeUntil,
  takeWhile,
  tap,
  timer,
  toArray,
  withLatestFrom,
} from "rxjs"
import { BlockInfo as RawBlockInfo } from "polkadot-api"

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
export interface BlockInfo {
  hash: string
  parent: string
  number: number
  body: string[] | null
  events: SystemEvent[] | null
  header: {
    parentHash: HexString
    number: number
    stateRoot: HexString
    extrinsicRoot: HexString
    digests: unknown[]
  } | null
  status: BlockState
  diff: Record<string, [string | null, string | null]> | null
}

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
finalizedBlocks$.subscribe()

export const [blockInfo$, recordedBlocks$] = partitionByKey(
  client$.pipe(switchMap((client) => client.blocks$)),
  (v) => v.hash,
  (block$) =>
    block$.pipe(
      take(1),
      withLatestFrom(client$),
      switchMap(
        ([{ hash, parent, number }, client]): Observable<BlockInfo> =>
          concat(
            combineLatest({
              hash: of(hash),
              parent: of(parent),
              number: of(number),
              body: client.watchBlockBody(hash).pipe(
                startWith(null),
                catchError((err) => {
                  console.error("fetch body failed", err)
                  return of(null)
                }),
              ),
              events: from(
                client.getUnsafeApi().query.System.Events.getValue({
                  at: hash,
                }),
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
            }),
            NEVER,
          ),
      ),
      takeUntil(
        merge(
          // Reset when client is changed
          client$.pipe(skip(1)),
          // Or after 1 hour
          timer(60 * 60 * 1000),
        ),
      ),
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
        body: client.watchBlockBody(hash),
        events: client.getUnsafeApi().query.System.Events.getValue({
          at: hash,
        }),
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
            digest: { logs: Array<unknown> }
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
        body: extrinsics,
        events: null,
        header: {
          digests: header.digest.logs,
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
inMemoryBlocks$.subscribe()

const blockHash$ = (hashOrHeight: string) =>
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
            catchError(() =>
              client
                .getUnsafeApi()
                .query.System.BlockHash.getValue(Number(hashOrHeight))
                .then((x: FixedSizeBinary<32>) => x.asHex()),
            ),
          ),
        ),
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

const getBlockStatus$ = (
  client: PolkadotClient,
  hash: string,
  number: number,
  parent: string,
): Observable<BlockState> =>
  client.bestBlocks$.pipe(
    withLatestFrom(finalizedBlocks$),
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
): Observable<Record<string, [string | null, string | null]> | null> =>
  chopsticksInstance$.pipe(
    take(1),
    switchMap((chain) => (chain ? chain.getBlock(hash as any) : [null])),
    switchMap((block) => (block ? block.storageDiff() : [null])),
    map((v) =>
      v && Object.keys(v).length > 0
        ? (v as Record<string, string | null>)
        : null,
    ),
    startWith(null),
    withLatestFrom(chainClient$),
    switchMap(([diff, { chainHead }]) => {
      if (!diff) return [null]

      return chainHead
        .storageQueries$(
          parent,
          Object.keys(diff).map((key) => ({
            key,
            type: "value",
          })),
        )
        .pipe(
          toArray(),
          map((v) => Object.fromEntries(v.map((v) => [v.key, v.value]))),
          map(
            (previousResults): Record<string, [string | null, string | null]> =>
              Object.fromEntries(
                Object.entries(diff)
                  .map(([key, newValue]) => [
                    key,
                    [previousResults[key] ?? null, newValue],
                  ])
                  .filter(([, [prevVal, newVal]]) => prevVal !== newVal),
              ),
          ),
          catchError((ex) => {
            console.error(ex)
            return [null]
          }),
        )
    }),
  )
