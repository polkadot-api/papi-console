import { blockInfo$ } from "@/state/block.state"
import { client$ } from "@/state/chains/chain.state"
import { withDefault } from "@react-rxjs/core"
import { mergeWithKey } from "@react-rxjs/utils"
import {
  combineLatest,
  debounceTime,
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
  share,
  skipUntil,
  startWith,
  switchMap,
  take,
  takeUntil,
} from "rxjs"
import { getBlockWeight } from "../Explorer/BlockPopover"

const withDefer =
  <I, O>(fn: () => OperatorFunction<I, O>): OperatorFunction<I, O> =>
  (source$) =>
    defer(() => fn()(source$))

// block number -> hash -> T
type BlockMap<T> = Array<Record<string, T>>
type BlockMapType<T> = T extends BlockMap<infer R> ? R : never

const blockStats$ = client$.pipeState(
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
    withDefer(() =>
      scan((acc: BlockMap<T> | null, evt) => {
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
          return result
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
            const targetChanged = !oldAcc || eqFn(oldAcc, newAcc)
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

        return hasChanged ? acc.map((v) => v) : acc
      }, null),
    ),
    distinctUntilChanged(),
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

export const blockFinalization$ = accumulate<{
  finalized: number | null
  finalizedSum: number | null
}>(
  (stats, prev) => {
    const parentTimings = prev?.acc
    const finalized = stats.finalized ? stats.finalized - stats.created : null

    return {
      finalized,
      finalizedSum: !finalized
        ? (parentTimings?.finalizedSum ?? null)
        : (parentTimings?.finalizedSum ?? 0) + finalized,
    }
  },
  (current, prev) => current.finalized === prev.finalizedSum,
)

export const blockTiming$ = client$.pipeState(
  switchMap((client) => {
    const initialBurst$ = client.blocks$.pipe(
      debounceTime(10),
      take(1),
      share(),
    )

    const timeRef = Date.now()
    // Block number -> Block -> timings
    const acc: Array<
      Record<
        string,
        {
          created: number
          blockTime: number | null
          blockTimeSum: number | null
          finalized: number | null
          finalizedSum: number | null
        }
      >
    > = []

    return mergeWithKey({
      newBlock: combineLatest({
        isBurst: initialBurst$.pipe(
          map(() => false),
          startWith(true),
        ),
        block: client.blocks$,
      }).pipe(map(({ block, isBurst }) => ({ ...block, isBurst }))),
      finalized: client.finalizedBlock$.pipe(skipUntil(initialBurst$)),
    }).pipe(
      scan((acc, { type, payload }) => {
        const now = Date.now() - timeRef
        const parent = acc[payload.number - 1]?.[payload.parent]
        if (type === "newBlock") {
          acc[payload.number] ??= {}
          const blockTime =
            parent && !payload.isBurst ? now - parent.created : null
          const blockTimeSum = blockTime
            ? (parent?.blockTimeSum ?? 0) + blockTime
            : null
          acc[payload.number][payload.hash] = {
            created: now,
            blockTime,
            blockTimeSum,
            finalized: null,
            finalizedSum: null,
          }
        }
        if (type === "finalized") {
          const current = acc[payload.number]?.[payload.hash]
          if (!current) {
            console.error("Unexpected finalized block", acc, payload)
            return acc
          }
          const finalized = now - current.created
          current.finalized = finalized
          current.finalizedSum = (parent?.finalizedSum ?? 0) + finalized
        }
        return acc
      }, acc),
    )
  }),
)

export const AVG_BLOCKS = 50
export const avgBlockTime$ = blockTimes$.pipeState(
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
