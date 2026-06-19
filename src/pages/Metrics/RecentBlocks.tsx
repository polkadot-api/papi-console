import { Link } from "@/hashParams"
import { state, useStateObservable } from "@react-rxjs/core"
import { combineLatest, map } from "rxjs"
import "uplot/dist/uPlot.min.css"
import { formatAge, formatInteger, formatPercent, shortHash } from "./format"
import { blockStats$, blockTimes$, blockWeights$ } from "./metrics.state"

const latestBlocks$ = state(
  combineLatest([blockStats$, blockTimes$, blockWeights$]).pipe(
    map(([{ stats }, blockTimes, blockWeights]) =>
      stats
        .slice(-8)
        .flatMap((blocks) => Object.values(blocks))
        .slice(-8)
        .map((block) => ({
          hash: block.hash,
          number: block.number,
          created: block.created,
          blockTime:
            blockTimes?.[block.number]?.[block.hash]?.blockTime ?? null,
          transactions: block.info.transactions,
          events: block.info.events,
          weight: blockWeights?.[block.number]?.[block.hash]?.weight ?? null,
        }))
        .sort((a, b) => a.number - b.number || a.created - b.created),
    ),
  ),
  [],
)

export const RecentBlocksTable = () => {
  const blocks = useStateObservable(latestBlocks$)
  const latest = blocks.at(-1) ?? null

  return (
    <table className="w-full min-w-120 text-sm">
      <thead>
        <tr className="border-b text-left text-xs font-medium text-muted-foreground">
          <th className="pb-3">Hash</th>
          <th className="pb-3">Time</th>
          <th className="pb-3 text-right">Txs</th>
          <th className="pb-3 text-right">Events</th>
          <th className="pb-3 text-right">Weight</th>
        </tr>
      </thead>
      <tbody>
        {blocks.map((block) => (
          <tr key={block.hash} className="border-b last:border-b-0">
            <td className="py-3 pr-3 font-mono text-xs font-semibold text-polkadot-500">
              <Link to={`/explorer/${block.hash}`} title={block.hash}>
                {shortHash(block.hash)}
              </Link>
            </td>
            <td className="py-3 pr-3 text-muted-foreground">
              {latest == null ? "-" : formatAge(latest.created - block.created)}
            </td>
            <td className="py-3 pr-3 text-right tabular-nums">
              {formatInteger(block.transactions)}
            </td>
            <td className="py-3 pr-3 text-right tabular-nums">
              {formatInteger(block.events)}
            </td>
            <td className="py-3 pr-3 text-right tabular-nums">
              {formatPercent(
                block.weight
                  ? Math.max(block.weight.refTime, block.weight.proofSize) * 100
                  : null,
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
