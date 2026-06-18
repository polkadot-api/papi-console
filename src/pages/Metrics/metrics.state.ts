import { blockInfo$ } from "@/state/block.state"
import { client$ } from "@/state/chains/chain.state"
import { DotAh } from "@polkadot-api/descriptors"
import { state, withDefault } from "@react-rxjs/core"
import {
  combineLatest,
  defer,
  distinctUntilChanged,
  endWith,
  filter,
  ignoreElements,
  map,
  mergeMap,
  ObservedValueOf,
  OperatorFunction,
  repeat,
  scan,
  startWith,
  switchMap,
  take,
  takeUntil,
  tap,
} from "rxjs"
import { getBlockWeight } from "../Explorer/BlockPopover"

// const logs = <T>(tag: string) =>
//   tap<T>({
//     next: () => console.log(tag, "next"),
//     unsubscribe: () => console.log(tag, "unsubscribe"),
//     subscribe: () => console.log(tag, "subscribe"),
//   })
const withDefer =
  <I, O>(fn: () => OperatorFunction<I, O>): OperatorFunction<I, O> =>
  (source$) =>
    defer(() => fn()(source$))

// block number -> hash -> T
type BlockMap<T> = Array<Record<string, T>>
type BlockMapType<T> = T extends BlockMap<infer R> ? R : never

export const blockStats$ = client$.pipeState(
  // logs("client$"),
  switchMap((client) => {
    const timeRef = Date.now()

    const groupStats = <T extends { hash: string; number: number }>() =>
      withDefer(() =>
        scan(
          (
            {
              stats,
            }: {
              stats: BlockMap<T>
              changed: T | null
            },
            block: T,
          ) => {
            stats[block.number] ??= {}
            stats[block.number][block.hash] = block
            return { stats, changed: block }
          },
          {
            stats: [],
            changed: null,
          },
        ),
      )

    const blocksComplete$ = client.blocks$.pipe(ignoreElements(), endWith(true))

    return client.blocks$.pipe(
      // logs("blocks$"),
      mergeMap((block) => {
        const created = Date.now() - timeRef

        const finalized$ = client.finalizedBlock$.pipe(
          filter((v) => block.hash === v.hash),
          take(1),
          map(() => Date.now() - timeRef),
          startWith(null),
        )

        const info$ = blockInfo$(block.hash).pipe(
          filter(
            (info) => info.body?.length != null || info.events?.length != null,
          ),
          map((info) => ({
            transactions: info.body?.length ?? null,
            events: info.events?.length ?? null,
            weight: getBlockWeight(info),
          })),
          startWith({
            transactions: null,
            events: null,
            weight: null,
          }),
        )

        return combineLatest([finalized$, info$]).pipe(
          map(([finalized, info]) => ({
            ...block,
            finalized,
            created,
            info,
          })),
        )
      }),
      groupStats(),
      takeUntil(blocksComplete$),
      repeat(),
    )
  }),
)
type BlockStats = BlockMapType<ObservedValueOf<typeof blockStats$>["stats"]>

const accumulate = <T>(
  acumulator: (
    stats: BlockStats,
    prev?: {
      acc: T
      stats: BlockStats
    },
  ) => T,
  eqFn: (current: T, prev: T) => boolean,
) =>
  blockStats$.pipeState(
    // logs("accumulate"),
    withDefer(() =>
      scan(
        ({ acc }: { changed: boolean; acc: BlockMap<T> | null }, evt) => {
          const getValue = (block: BlockStats, accs: BlockMap<T>) => {
            const parent = evt.stats[block.number - 1]?.[block.parent]
            const parentAcc = accs[block.number - 1]?.[block.parent]

            return acumulator(block, { acc: parentAcc, stats: parent })
          }

          if (!acc) {
            const result: BlockMap<T> = []
            for (const i in evt.stats) {
              result[i] ??= {}
              const blocks = evt.stats[i]
              for (const hash in blocks) {
                result[i][hash] = getValue(blocks[hash], result)
              }
            }
            return {
              changed: true,
              acc: result,
            }
          }

          let hasChanged = false
          if (evt.changed) {
            let toUpdate = [evt.changed]
            while (toUpdate.length) {
              const target = toUpdate.pop()!
              acc[target.number] ??= {}
              const oldAcc = acc[target.number][target.hash]
              const newAcc = (acc[target.number][target.hash] = getValue(
                target,
                acc,
              ))
              const targetChanged = !oldAcc || !eqFn(oldAcc, newAcc)
              hasChanged ||= targetChanged
              if (targetChanged) {
                toUpdate = [
                  ...toUpdate,
                  ...Object.values(evt.stats[target.number + 1] ?? {}).filter(
                    (block) => block.parent === target.hash,
                  ),
                ]
              }
            }
          }

          return {
            changed: hasChanged,
            acc,
          }
        },
        { changed: false, acc: null },
      ),
    ),
    filter((v) => v.changed),
    map((v) => v.acc),
  )

export const blockTimes$ = accumulate<{
  blockTime: number | null
  created: number
}>(
  (stats, prev) => {
    const parent = prev?.stats

    const isBurst = !parent || stats.created - parent.created <= 1
    const blockTime = isBurst || !parent ? null : stats.created - parent.created

    return {
      blockTime,
      created: stats.created,
    }
  },
  () => true,
)

export const AVG_BLOCKS = 50
export const avgBlockTime$ = blockTimes$.pipeState(
  // logs("avgBlockTimes"),
  filter((v) => v != null),
  map((blocks) =>
    blocks
      .slice(-AVG_BLOCKS)
      // blocks is an array that starts at "block_number". filter makes it 0-based instead, which is what we need
      .filter((v) => Object.values(v).some((v) => v.blockTime != null)),
  ),
  // TODO so many updates?
  // tap((v) => console.log("time", v)),
  filter((v) => v.length >= 3),
  map((blocks) => {
    // We're skipping the first one since it's very often an outlier
    const first = Object.values(blocks[1]).find((v) => v.blockTime != null)!
    const last = Object.values(blocks.at(-1)!).find((v) => v.blockTime != null)!
    return (last.created! - first.created!) / (blocks.length - 2)
  }),
  withDefault(null),
)

export const blockFinalization$ = accumulate<{
  finalized: number | null
  finalizedSum: number | null
}>(
  (stats, prev) => {
    const parentTimings = prev?.acc
    const finalized =
      stats.finalized != null ? stats.finalized - stats.created : null

    return {
      finalized,
      finalizedSum:
        finalized == null
          ? (parentTimings?.finalizedSum ?? null)
          : (parentTimings?.finalizedSum ?? 0) + finalized,
    }
  },
  (current, prev) => current.finalizedSum === prev.finalizedSum,
)
export const avgFinalizedTime$ = blockFinalization$.pipeState(
  filter((v) => v != null),
  map((blocks) =>
    blocks
      .slice(-AVG_BLOCKS)
      // blocks is an array that starts at "block_number". filter makes it 0-based instead, which is what we need
      .filter((v) =>
        Object.values(v).some(
          (v) => v.finalized !== null && v.finalizedSum != null,
        ),
      ),
  ),
  filter((v) => v.length >= 3),
  map((blocks) => {
    // We're skipping the first one since it's very often an outlier
    const first = Object.values(blocks[1]).find(
      (v) => v.finalized !== null && v.finalizedSum != null,
    )!
    const last = Object.values(blocks.at(-1)!).find(
      (v) => v.finalized !== null && v.finalizedSum != null,
    )!
    return (last.finalizedSum! - first.finalizedSum!) / (blocks.length - 2)
  }),
  withDefault(null),
)

export const transactionCount$ = accumulate<{
  created: number
  transactionSum: number | null
}>(
  (stats, prev) => {
    const parentAcc = prev?.acc
    const transactions = stats.info.transactions

    return {
      created: stats.created,
      transactionSum:
        transactions == null
          ? (parentAcc?.transactionSum ?? null)
          : (parentAcc?.transactionSum ?? 0) + transactions,
    }
  },
  (current, prev) => current.transactionSum === prev.transactionSum,
)
export const transactionsStats$ = transactionCount$.pipeState(
  filter((v) => v != null),
  map((blocks) =>
    blocks
      .slice(-AVG_BLOCKS)
      // blocks is an array that starts at "block_number". filter makes it 0-based instead, which is what we need
      .filter((v) => Object.values(v).some((v) => v.transactionSum !== null)),
  ),
  filter((v) => v.length >= 2),
  map((blocks) => {
    const first = Object.values(blocks[0]).find(
      (v) => v.transactionSum != null,
    )!
    const last = Object.values(blocks.at(-1)!).find(
      (v) => v.transactionSum !== null,
    )!
    const totalCount = last.transactionSum! - first.transactionSum!
    const tpm = (totalCount * (1000 * 60)) / (last.created - first.created)
    return { totalCount, tpm }
  }),
  withDefault(null),
)

export const blockWeights$ = client$.pipeState(
  switchMap((client) =>
    client
      .getUnsafeApi<DotAh>()
      .constants.System.BlockWeights()
      .catch(() => null),
  ),
  map((v) => v?.max_block ?? null),
  switchMap((max_weight) =>
    max_weight
      ? accumulate<{
          weight: { refTime: number; proofSize: number } | null
          weightSum: { refTime: number; proofSize: number } | null
        }>(
          (stats, prev) => {
            const parentAcc = prev?.acc
            const weight = stats.info.weight

            const weightPct = weight
              ? {
                  refTime:
                    Number(weight.ref_time) / Number(max_weight.ref_time),
                  proofSize:
                    Number(weight.proof_size) / Number(max_weight.proof_size),
                }
              : null

            return {
              weight: weightPct,
              weightSum:
                weightPct == null
                  ? (parentAcc?.weightSum ?? null)
                  : {
                      refTime:
                        (parentAcc?.weightSum?.refTime ?? 0) +
                        weightPct.refTime,
                      proofSize:
                        (parentAcc?.weightSum?.proofSize ?? 0) +
                        weightPct.proofSize,
                    },
            }
          },
          (current, prev) => current.weightSum === prev.weightSum,
        )
      : [null],
  ),
)

export const avgBlockWeight$ = blockWeights$.pipeState(
  filter((v) => v != null),
  map((blocks) =>
    blocks
      .slice(-AVG_BLOCKS)
      // blocks is an array that starts at "block_number". filter makes it 0-based instead, which is what we need
      .filter((v) => Object.values(v).some((v) => v.weightSum !== null)),
  ),
  filter((v) => v.length >= 2),
  map((blocks) => {
    // Although we might match different branches, they happen very randomly and we're
    // computing a long average, so the difference will be minimal.
    const first = Object.values(blocks[0]).find((v) => v.weightSum != null)!
    const last = Object.values(blocks.at(-1)!).find(
      (v) => v.weightSum !== null,
    )!
    return {
      refTime:
        (last.weightSum!.refTime - first.weightSum!.refTime) /
        (blocks.length - 1),
      proofSize:
        (last.weightSum!.proofSize - first.weightSum!.proofSize) /
        (blocks.length - 1),
    }
  }),
  withDefault(null),
)

const RECENT_BLOCKS = 80
export type RecentMetricBlock = {
  hash: string
  parent: string
  number: number
  created: number
  finalized: number | null
  finalizationTime: number | null
  blockTime: number | null
  transactions: number | null
  events: number | null
  weight: {
    refTime: number
    proofSize: number
  } | null
}
export const recentMetricBlocks$ = state(
  combineLatest([
    blockStats$,
    blockTimes$,
    blockFinalization$,
    blockWeights$,
  ]).pipe(
    map(([{ stats }, blockTimes, blockFinalization, blockWeights]) =>
      stats
        .slice(-RECENT_BLOCKS)
        .flatMap((blocks) => Object.values(blocks ?? {}))
        .map(
          (block): RecentMetricBlock => ({
            hash: block.hash,
            parent: block.parent,
            number: block.number,
            created: block.created,
            finalized: block.finalized,
            finalizationTime:
              blockFinalization?.[block.number]?.[block.hash]?.finalized ??
              null,
            blockTime:
              blockTimes?.[block.number]?.[block.hash]?.blockTime ?? null,
            transactions: block.info.transactions,
            events: block.info.events,
            weight: blockWeights?.[block.number]?.[block.hash]?.weight ?? null,
          }),
        )
        .sort((a, b) => a.number - b.number || a.created - b.created),
    ),
  ),
  [],
)
