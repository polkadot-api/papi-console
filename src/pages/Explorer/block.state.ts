import { chainClient$, chainHead$ } from "@/state/chains/chain.state"
import {
  ChainHead$,
  PinnedBlocks,
  SystemEvent,
} from "@polkadot-api/observable-client"
import { StopError } from "@polkadot-api/substrate-client"
import { state, withDefault } from "@react-rxjs/core"
import { partitionByKey, toKeySet } from "@react-rxjs/utils"
import { HexString } from "polkadot-api"
import {
  catchError,
  combineLatest,
  concat,
  concatMap,
  defer,
  distinctUntilChanged,
  EMPTY,
  filter,
  forkJoin,
  map,
  merge,
  mergeMap,
  NEVER,
  Observable,
  ObservedValueOf,
  of,
  repeat,
  retry,
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
  withLatestFrom,
} from "rxjs"

export const finalized$ = chainHead$.pipeState(
  switchMap((chainHead) => chainHead.finalized$),
  withDefault(null),
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
}
export const [blockInfo$, recordedBlocks$] = partitionByKey(
  chainHead$.pipe(
    switchMap((chainHead) =>
      chainHead.follow$.pipe(
        withInitializedNumber(),
        scan(
          (acc, evt) => {
            switch (evt.type) {
              case "initialized": {
                const blockNumbers: Record<string, number> = {}
                evt.finalizedBlockHashes.forEach((hash, i) => {
                  const parent = blockNumbers[evt.finalizedBlockHashes[i - 1]]
                  blockNumbers[hash] = parent != null ? parent + 1 : evt.number
                })
                return {
                  value: evt.finalizedBlockHashes.map((hash, i) => ({
                    hash,
                    parent: evt.finalizedBlockHashes[i - 1] || evt.parentHash,
                    number: blockNumbers[hash],
                  })),
                  blockNumbers,
                }
              }
              case "newBlock": {
                const number = acc.blockNumbers[evt.parentBlockHash] + 1
                acc.blockNumbers[evt.blockHash] = number
                return {
                  value: [
                    {
                      hash: evt.blockHash,
                      parent: evt.parentBlockHash,
                      number,
                    },
                  ],
                  blockNumbers: acc.blockNumbers,
                }
              }
            }
            return { value: [], blockNumbers: acc.blockNumbers }
          },
          { value: [], blockNumbers: {} } as {
            value: Array<{
              hash: string
              parent: string
              number: number
            }>
            blockNumbers: Record<string, number>
          },
        ),
        mergeMap(({ value }) => value),
        retryOnStopError(),
      ),
    ),
  ),
  (v) => v.hash,
  (initialized$) =>
    initialized$.pipe(
      take(1),
      withLatestFrom(chainHead$),
      switchMap(
        ([{ hash, parent, number }, chainHead]): Observable<BlockInfo> =>
          concat(
            combineLatest({
              hash: of(hash),
              parent: of(parent),
              number: of(number),
              body: chainHead.body$(hash).pipe(
                startWith(null),
                catchError((err) => {
                  console.error("fetch body failed", err)
                  return of(null)
                }),
              ),
              events: chainHead.eventsAt$(hash).pipe(
                startWith(null),
                catchError((err) => {
                  console.error("fetch events failed", err)
                  return of(null)
                }),
              ),
              header: chainHead.header$(hash).pipe(
                startWith(null),
                catchError((err) => {
                  console.error("fetch header failed", err)
                  return of(null)
                }),
              ),
              status: getBlockStatus$(chainHead, hash, number),
            }),
            NEVER,
          ),
      ),
      takeUntil(
        merge(
          // Reset when chainHead is changed
          chainHead$.pipe(skip(1)),
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

function withInitializedNumber() {
  return (source$: Observable<ObservedValueOf<ChainHead$["follow$"]>>) =>
    source$.pipe(
      withLatestFrom(chainHead$),
      concatMap(([event, chainHead]) => {
        return event.type !== "initialized"
          ? of(event)
          : chainHead.header$(event.finalizedBlockHashes[0]).pipe(
              map((header) => ({
                ...event,
                number: header.number,
                parentHash: header.parentHash,
              })),
            )
      }),
    )
}

const getBlockStatus$ = (
  chainHead: ChainHead$,
  hash: string,
  number: number,
): Observable<BlockState> =>
  chainHead.pinnedBlocks$.pipe(
    take(1),
    switchMap((pinnedBlocks) => {
      const block = (hash: string) => pinnedBlocks.blocks.get(hash)
      const blockNum = (hash: string) => block(hash)?.number
      const finalized = blockNum(pinnedBlocks.finalized)!
      if (number <= finalized) {
        // assume we are in the list of finalized blocks on `initialized`
        return of(BlockState.Finalized)
      }

      const getInitialState = (pinnedBlocks: PinnedBlocks) => {
        let bestBranch = pinnedBlocks.best
        while (blockNum(bestBranch)! > finalized && hash !== bestBranch) {
          bestBranch = block(bestBranch)!.parent
        }
        return block(bestBranch)?.hash === hash
          ? BlockState.Best
          : BlockState.Fork
      }
      const initialState = getInitialState(pinnedBlocks)

      return chainHead.follow$.pipe(
        concatMap((evt) => {
          switch (evt.type) {
            case "bestBlockChanged":
              return chainHead.pinnedBlocks$.pipe(take(1), map(getInitialState))
            case "finalized":
              if (evt.finalizedBlockHashes.includes(hash))
                return of(BlockState.Finalized)
              if (evt.prunedBlockHashes.includes(hash))
                return of(BlockState.Pruned)
          }
          return of(null)
        }),
        filter((v) => v !== null),
        retryOnStopError(),
        takeWhile(
          (v) => v !== BlockState.Finalized && v !== BlockState.Pruned,
          true,
        ),
        startWith(initialState),
      )
    }),
  )

const retryOnStopError = <T>() =>
  retry<T>({
    delay(error) {
      if (error instanceof StopError) {
        return of(null)
      }
      throw error
    },
  })
