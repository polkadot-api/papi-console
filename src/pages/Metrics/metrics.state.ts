import { blockInfo$ } from "@/state/block.state"
import { client$ } from "@/state/chains/chain.state"
import { DotAh } from "@polkadot-api/descriptors"
import {
  combineLatest,
  defer,
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
export type BlockMap<T> = Array<Record<string, T>>
export type BlockMapType<T> = T extends BlockMap<infer R> ? R : never

export const WINDOW_SIZE = 50
export const blockStats$ = client$.pipeState(
  switchMap((client) => {
    const timeRef = Date.now()

    const groupStats = <T extends { hash: string; number: number }>() =>
      withDefer(() =>
        scan(
          (
            {
              stats,
              cleanFrom,
            }: {
              stats: BlockMap<T>
              cleanFrom: number
              changed: T | null
            },
            block: T,
          ) => {
            stats[block.number] ??= {}
            stats[block.number][block.hash] = block
            const newCleanFrom = pruneOldBlocks(stats, cleanFrom)
            return { stats, changed: block, cleanFrom: newCleanFrom }
          },
          {
            stats: [],
            cleanFrom: 0,
            changed: null,
          },
        ),
      )

    const blocksComplete$ = client.blocks$.pipe(ignoreElements(), endWith(true))

    return client.blocks$.pipe(
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

const pruneOldBlocks = <T>(blocks: BlockMap<T>, cleanFrom: number) => {
  // Initial state we can skip to the first window, to include out-of-order blocks
  if (cleanFrom === 0) return blocks.length - WINDOW_SIZE
  // Skip if we're in a window-size length
  if (blocks.length - cleanFrom < WINDOW_SIZE * 3) return cleanFrom
  for (let i = cleanFrom; i < blocks.length - WINDOW_SIZE * 2; i++) {
    delete blocks[i]
  }
  return blocks.length - WINDOW_SIZE * 2
}

const accumulate = <T>(
  acumulator: (
    stats: BlockStats,
    prev?: {
      acc: T
      stats: BlockStats
    },
  ) => T,
  eqFn: (current: T, prev: T) => boolean,
  hasValue: (value: T) => boolean,
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

          // We could prune the sparse-array acc as well, but I'm keeping it separate
          // as this observable only lives as long as there's a component subscribing to it
          // (whereas blockStats$ is designed to be long-lived)

          return {
            changed: hasChanged,
            acc,
          }
        },
        { changed: false, acc: null },
      ),
    ),
    filter((v) => v.changed && v.acc !== null),
    map((v): Array<Record<string, T>> => {
      const broadSlice = v.acc!.slice(-2 * WINDOW_SIZE)
      const lastWithValue = broadSlice.findLastIndex(
        (v) => v && Object.values(v).some(hasValue),
      )
      const r = broadSlice!
        .slice(-(broadSlice!.length - lastWithValue + WINDOW_SIZE))
        // Remove empty values, since we're turning this into a 0-based array.
        .filter(() => true)
      return r
    }),
  )

export const blockTimes$ = accumulate<{
  parent: string
  blockTime: number | null
  created: number
}>(
  (stats, prev) => {
    const parent = prev?.stats

    const isBurst = !parent || stats.created - parent.created <= 1
    const blockTime = isBurst || !parent ? null : stats.created - parent.created

    return {
      parent: stats.parent,
      blockTime,
      created: stats.created,
    }
  },
  () => true,
  (v) => v.blockTime != null,
)

export const blockFinalization$ = accumulate<{
  parent: string
  finalized: number | null
  finalizedSum: number | null
}>(
  (stats, prev) => {
    const parentTimings = prev?.acc
    const finalized =
      stats.finalized != null ? stats.finalized - stats.created : null

    return {
      parent: stats.parent,
      finalized,
      finalizedSum:
        finalized == null
          ? (parentTimings?.finalizedSum ?? null)
          : (parentTimings?.finalizedSum ?? 0) + finalized,
    }
  },
  (current, prev) => current.finalizedSum === prev.finalizedSum,
  (v) => v.finalized != null,
)

export const transactionCount$ = accumulate<{
  parent: string
  created: number
  transactions: number | null
  transactionSum: number | null
}>(
  (stats, prev) => {
    const parentAcc = prev?.acc
    const transactions = stats.info.transactions

    return {
      parent: stats.parent,
      created: stats.created,
      transactions,
      transactionSum:
        transactions == null
          ? (parentAcc?.transactionSum ?? null)
          : (parentAcc?.transactionSum ?? 0) + transactions,
    }
  },
  (current, prev) => current.transactionSum === prev.transactionSum,
  (v) => v.transactions != null,
)

export const eventsCount$ = accumulate<{
  parent: string
  created: number
  events: number | null
  eventSum: number | null
}>(
  (stats, prev) => {
    const parentAcc = prev?.acc
    const events = stats.info.events

    return {
      parent: stats.parent,
      created: stats.created,
      events,
      eventSum:
        events == null
          ? (parentAcc?.eventSum ?? null)
          : (parentAcc?.eventSum ?? 0) + events,
    }
  },
  (current, prev) => current.eventSum === prev.eventSum,
  (v) => v.events != null,
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
          parent: string
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
              parent: stats.parent,
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
          (v) => v.weight !== null,
        )
      : [null],
  ),
)
