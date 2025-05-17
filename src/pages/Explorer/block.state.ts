import { chopsticksInstance$ } from "@/chopsticks/chopsticks"
import { chainClient$, client$ } from "@/state/chains/chain.state"
import { SystemEvent } from "@polkadot-api/observable-client"
import { state } from "@react-rxjs/core"
import { partitionByKey, toKeySet } from "@react-rxjs/utils"
import { HexString, PolkadotClient } from "polkadot-api"
import {
  catchError,
  combineLatest,
  concat,
  defer,
  distinctUntilChanged,
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

export const finalized$ = client$.pipeState(
  switchMap((client) => client.finalizedBlock$),
)

export enum BlockState {
  Fork = "fork",
  Best = "best",
  Finalized = "finalized",
  Pruned = "pruned",
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
              status: getBlockStatus$(client, hash, number),
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

const getUnpinnedBlockInfo$ = (hash: string): Observable<BlockInfo> => {
  const throughRpc$ = chainClient$.pipe(
    switchMap((client) =>
      defer(() =>
        client.client._request<
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
      ),
    ),
    filter((v) => !!v),
    take(1),
    catchError(() => EMPTY),
  )

  return throughRpc$.pipe(
    map(
      ({ block: { extrinsics, header } }): BlockInfo => ({
        hash,
        parent: header.parentHash,
        body: extrinsics,
        events: null,
        header: {
          digests: header.digest.logs,
          extrinsicRoot: header.extrinsicsRoot,
          number: Number(header.number),
          parentHash: header.parentHash,
          stateRoot: header.stateRoot,
        },
        number: Number(header.number),
        status: BlockState.Finalized,
        diff: null,
      }),
    ),
    tap((v) => disconnectedBlocks$.next(v)),
  )
}

export const blockInfoState$ = state(
  (hash: string) =>
    recordedBlocks$.pipe(
      toKeySet(),
      map((blocks) => blocks.has(hash)),
      distinctUntilChanged(),
      switchMap((exists) =>
        exists ? blockInfo$(hash) : getUnpinnedBlockInfo$(hash),
      ),
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

const getBlockStatus$ = (
  client: PolkadotClient,
  hash: string,
  number: number,
): Observable<BlockState> =>
  merge(
    client.finalizedBlock$.pipe(
      take(1),
      // If the latest finalized is ahead, assume it is finalized (?)
      filter((b) => b.number > number),
      map(() => BlockState.Finalized),
    ),
    combineLatest([client.bestBlocks$, client.finalizedBlock$]).pipe(
      map(([best, finalized]) => {
        if (finalized.hash === hash) return BlockState.Finalized
        if (finalized.number === number) return BlockState.Pruned
        if (best.some((b) => b.hash === hash)) return BlockState.Best
        return BlockState.Fork
      }),
    ),
  ).pipe(
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
          map(
            (previousResults): Record<string, [string | null, string | null]> =>
              Object.fromEntries(
                previousResults
                  .map((result) => [
                    result.key,
                    [result.value ?? null, diff[result.key]],
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
