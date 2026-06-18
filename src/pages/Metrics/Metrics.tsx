import { Link } from "@/hashParams"
import { client$ } from "@/state/chains/chain.state"
import { useStateObservable, withDefault } from "@react-rxjs/core"
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Copy,
  Flag,
  Network,
  RefreshCw,
  Scale,
  ShieldCheck,
} from "lucide-react"
import { FC, ReactNode, useEffect, useMemo, useRef } from "react"
import { catchError, combineLatest, from, map, of, switchMap } from "rxjs"
import uPlot from "uplot"
import "uplot/dist/uPlot.min.css"
import { CenteredScrollContainer } from "../AppShell"
import {
  AVG_BLOCKS,
  avgBlockTime$,
  avgBlockWeight$,
  avgFinalizedTime$,
  eventsStats$,
  recentMetricBlocks$,
  transactionsStats$,
} from "./metrics.state"
import type { RecentMetricBlock } from "./metrics.state"

const chainStatus$ = client$.pipeState(
  switchMap((client) =>
    combineLatest({
      best: client.bestBlocks$.pipe(
        map(([block]) => ({ hash: block.hash, number: block.number })),
      ),
      finalized: client.finalizedBlock$.pipe(
        map((block) => ({ hash: block.hash, number: block.number })),
      ),
    }),
  ),
  withDefault(null),
)

const nodeHealth$ = client$.pipeState(
  switchMap((client) =>
    from(
      client._request<{
        peers: number
        isSyncing: boolean
        shouldHavePeers: boolean
      }>("system_health", []),
    ).pipe(catchError(() => of(null))),
  ),
  withDefault(null),
)

export default function Metrics() {
  const avgBlockTime = useStateObservable(avgBlockTime$)
  const avgFinalizedTime = useStateObservable(avgFinalizedTime$)
  const transactionStats = useStateObservable(transactionsStats$)
  const eventStats = useStateObservable(eventsStats$)
  const avgBlockWeight = useStateObservable(avgBlockWeight$)
  const blocks = useStateObservable(recentMetricBlocks$)
  const chainStatus = useStateObservable(chainStatus$)
  const nodeHealth = useStateObservable(nodeHealth$)

  const latest = blocks.at(-1) ?? null
  const latestWeight =
    latest?.weight &&
    Math.max(latest.weight.refTime, latest.weight.proofSize) * 100
  const avgWeight =
    avgBlockWeight &&
    Math.max(avgBlockWeight.refTime, avgBlockWeight.proofSize) * 100

  return (
    <CenteredScrollContainer className="max-w-[1440px] px-4 py-6 lg:px-6">
      <div className="space-y-5 pb-10">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-normal text-foreground">
            Chain metrics
          </h1>
          <p className="text-sm text-muted-foreground">
            Live network health and throughput for the selected chain.
          </p>
        </header>

        <section className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-lg border bg-card px-4 py-3 text-sm shadow-sm">
          <StatusPill healthy={!nodeHealth?.isSyncing} />
          <SummaryPair
            label="Latest block"
            value={formatBlockNumber(chainStatus?.best.number)}
          />
          <SummaryPair
            label="Finalized"
            value={formatBlockNumber(chainStatus?.finalized.number)}
          />
          <div className="ml-auto flex items-center gap-2 text-muted-foreground">
            <span>{latest ? `${formatAge(0)} updated` : "Waiting"}</span>
            <RefreshCw className="h-4 w-4" />
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <MetricCard
            title="Block time"
            value={formatDuration(avgBlockTime)}
            caption={`avg over last ${AVG_BLOCKS} blocks`}
            icon={<Clock3 className="h-5 w-5" />}
            color="#ec4899"
            blocks={blocks}
            select={(block) => toSeconds(block.blockTime)}
          />
          <MetricCard
            title="Finalization time"
            value={formatDuration(avgFinalizedTime)}
            caption={`avg over last ${AVG_BLOCKS} blocks`}
            icon={<ShieldCheck className="h-5 w-5" />}
            color="#ec4899"
            blocks={blocks}
            select={(block) => toSeconds(block.finalizationTime)}
          />
          <MetricCard
            title="Block weight"
            value={formatPercent(avgWeight)}
            caption="of max block weight"
            icon={<Scale className="h-5 w-5" />}
            color="#e6007a"
            blocks={blocks}
            select={(block) =>
              block.weight
                ? Math.max(block.weight.refTime, block.weight.proofSize) * 100
                : null
            }
          />
          <MetricCard
            title="Transactions"
            value={formatInteger(transactionStats?.totalCount)}
            caption={`${formatInteger(transactionStats?.tpm)} tx/min`}
            icon={<ArrowRight className="h-5 w-5" />}
            color="#8b5cf6"
            blocks={blocks}
            select={(block) => block.transactions}
          />
          <MetricCard
            title="Events"
            value={formatInteger(eventStats?.totalCount)}
            caption={`${formatInteger(eventStats?.epm)} events/min`}
            icon={<Flag className="h-5 w-5" />}
            color="#8b5cf6"
            blocks={blocks}
            select={(block) => block.events}
          />
          <MetricCard
            title="Connected peers"
            value={formatInteger(nodeHealth?.peers)}
            caption={nodeHealth ? nodeStatusText(nodeHealth) : "unavailable"}
            icon={<Network className="h-5 w-5" />}
            color="#8b5cf6"
            blocks={[]}
            select={() => null}
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-[1fr_1.05fr]">
          <RecentBlocksTable
            blocks={blocks}
            finalizedNumber={chainStatus?.finalized.number ?? null}
            latestCreated={latest?.created ?? null}
          />

          <Panel title="Node status" action={<Copy className="h-4 w-4" />}>
            <NodeStatus
              best={chainStatus?.best.number ?? null}
              finalized={chainStatus?.finalized.number ?? null}
              peers={nodeHealth?.peers ?? null}
              isSyncing={nodeHealth?.isSyncing ?? null}
              latestWeight={latestWeight ?? null}
            />
          </Panel>
        </section>
      </div>
    </CenteredScrollContainer>
  )
}

const MetricCard: FC<{
  title: string
  value: string
  caption: string
  icon: ReactNode
  color: string
  blocks: RecentMetricBlock[]
  select: (block: RecentMetricBlock) => number | null
}> = ({ title, value, caption, icon, color, blocks, select }) => (
  <article className="min-h-36 rounded-lg border bg-card p-5 shadow-sm">
    <div className="mb-3 flex items-start justify-between gap-4">
      <h2 className="text-sm font-semibold text-card-foreground">{title}</h2>
      <div className="text-muted-foreground">{icon}</div>
    </div>
    <div className="grid grid-cols-[minmax(0,0.85fr)_minmax(150px,1.15fr)] items-end gap-4">
      <div className="min-w-0">
        <div className="text-3xl font-semibold leading-tight tabular-nums">
          {value}
        </div>
        <div className="mt-1 text-sm text-muted-foreground">{caption}</div>
      </div>
      <ForkChart
        blocks={blocks}
        select={select}
        color={color}
        compact
        height={112}
      />
    </div>
  </article>
)

const Panel: FC<{
  title: string
  action?: ReactNode
  children: ReactNode
}> = ({ title, action, children }) => (
  <section className="rounded-lg border bg-card shadow-sm">
    <div className="flex h-14 items-center justify-between border-b px-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      {action ? <div className="text-muted-foreground">{action}</div> : null}
    </div>
    <div className="p-5">{children}</div>
  </section>
)

const RecentBlocksTable: FC<{
  blocks: RecentMetricBlock[]
  finalizedNumber: number | null
  latestCreated: number | null
}> = ({ blocks, finalizedNumber, latestCreated }) => {
  const rows = blocks.slice(-7).reverse()

  return (
    <Panel title="Recent blocks" action={<Copy className="h-4 w-4" />}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs font-medium text-muted-foreground">
              <th className="pb-3">Block</th>
              <th className="pb-3">Time</th>
              <th className="pb-3 text-right">Txs</th>
              <th className="pb-3 text-right">Events</th>
              <th className="pb-3 text-right">Weight</th>
              <th className="pb-3 text-right">Finalized</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((block) => (
              <tr key={block.hash} className="border-b last:border-b-0">
                <td className="py-3 pr-3 font-mono text-xs font-semibold text-polkadot-500">
                  <Link to={`/explorer/${block.hash}`}>
                    #{block.number.toLocaleString()}
                  </Link>
                </td>
                <td className="py-3 pr-3 text-muted-foreground">
                  {latestCreated == null
                    ? "-"
                    : formatAge(latestCreated - block.created)}
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
                      ? Math.max(block.weight.refTime, block.weight.proofSize) *
                          100
                      : null,
                  )}
                </td>
                <td className="py-3 text-right">
                  {finalizedNumber != null &&
                  block.number <= finalizedNumber ? (
                    <CheckCircle2 className="ml-auto h-4 w-4 text-green-600" />
                  ) : (
                    <Activity className="ml-auto h-4 w-4 text-muted-foreground" />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Link
        to="/explorer"
        className="mt-4 flex items-center justify-center gap-2 border-t pt-4 text-sm font-medium text-polkadot-500 hover:text-polkadot-600"
      >
        View all blocks <ArrowRight className="h-4 w-4" />
      </Link>
    </Panel>
  )
}

const NodeStatus: FC<{
  best: number | null
  finalized: number | null
  peers: number | null
  isSyncing: boolean | null
  latestWeight: number | null
}> = ({ best, finalized, peers, isSyncing, latestWeight }) => (
  <div className="space-y-5 text-sm">
    <div className="space-y-3">
      <StatusRow label="Connected peers" value={formatInteger(peers)} />
      <StatusRow label="Best block" value={formatBlockNumber(best)} accent />
      <StatusRow
        label="Finalized block"
        value={formatBlockNumber(finalized)}
        accent
      />
      <StatusRow label="Latest weight" value={formatPercent(latestWeight)} />
    </div>
    <div className="border-t pt-4 space-y-3">
      <HealthRow label="Node sync" healthy={isSyncing === false} />
      <HealthRow
        label="Network connectivity"
        healthy={peers == null || peers > 0}
      />
      <HealthRow label="RPC server" healthy />
      <HealthRow label="Metrics stream" healthy={best != null} />
    </div>
  </div>
)

const ForkChart: FC<{
  blocks: RecentMetricBlock[]
  select: (block: RecentMetricBlock) => number | null
  color: string
  height: number
  compact?: boolean
}> = ({ blocks, select, color, height, compact }) => {
  const chart = useMemo(
    () => buildForkChartData(blocks, select),
    [blocks, select],
  )

  if (!chart.data[0].length) {
    return <div className="h-full min-h-16 rounded bg-muted/30" />
  }

  return (
    <UPlotChart
      data={chart.data}
      seriesCount={chart.seriesCount}
      primaryLane={chart.primaryLane}
      yRange={chart.yRange}
      color={color}
      height={height}
      compact={compact}
    />
  )
}

const UPlotChart: FC<{
  data: uPlot.AlignedData
  seriesCount: number
  primaryLane: number
  yRange: [number, number]
  color: string
  height: number
  compact?: boolean
}> = ({ data, seriesCount, primaryLane, yRange, color, height, compact }) => {
  const ref = useRef<HTMLDivElement>(null)
  const plotRef = useRef<uPlot | null>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const width = Math.max(element.clientWidth, 120)
    const plot = new uPlot(
      getChartOptions({
        width,
        height,
        seriesCount,
        primaryLane,
        yRange,
        color,
        compact: Boolean(compact),
      }),
      data,
      element,
    )
    plotRef.current = plot

    const resizeObserver = new ResizeObserver(([entry]) => {
      plot.setSize({
        width: Math.max(entry.contentRect.width, 120),
        height,
      })
    })
    resizeObserver.observe(element)

    return () => {
      resizeObserver.disconnect()
      plot.destroy()
      plotRef.current = null
    }
  }, [color, compact, data, height, primaryLane, seriesCount, yRange])

  return <div ref={ref} className="h-full min-h-16 w-full [&_.uplot]:w-full" />
}

const getChartOptions = ({
  width,
  height,
  seriesCount,
  primaryLane,
  yRange,
  color,
  compact,
}: {
  width: number
  height: number
  seriesCount: number
  primaryLane: number
  yRange: [number, number]
  color: string
  compact: boolean
}): uPlot.Options => ({
  width,
  height,
  legend: { show: false },
  cursor: { show: false },
  scales: {
    x: { time: false },
    y: {
      range: () => yRange,
    },
  },
  axes: [
    { show: false },
    {
      side: 1,
      size: compact ? 34 : 42,
      gap: compact ? 3 : 5,
      stroke: "rgba(100,116,139,0.75)",
      grid: { stroke: "rgba(148,163,184,0.16)", width: 1 },
      ticks: { show: false },
      border: { show: false },
      splits: (_plot, _axisIdx, scaleMin, scaleMax, foundIncr) =>
        getAxisSplits(scaleMin, scaleMax, foundIncr),
      values: (_u, values) =>
        values.map((value) =>
          compact ? formatCompactAxisValue(value) : formatAxisValue(value),
        ),
    },
  ],
  series: [
    {},
    ...Array.from({ length: seriesCount }, (_, index) => ({
      stroke: index === primaryLane ? color : withAlpha(color, 0.5),
      width: index === primaryLane ? (compact ? 2 : 1.8) : 1.5,
      points: { show: false },
      spanGaps: false,
    })),
  ],
})

const buildForkChartData = (
  blocks: RecentMetricBlock[],
  select: (block: RecentMetricBlock) => number | null,
) => {
  const rowsByNumber = blocks
    .map((block) => ({ ...block, value: select(block) }))
    .filter((block): block is RecentMetricBlock & { value: number } =>
      Number.isFinite(block.value),
    )
    .sort((a, b) => a.number - b.number || a.created - b.created)

  const xValues = [...new Set(rowsByNumber.map((block) => block.number))]
    .sort((a, b) => a - b)
    .slice(-AVG_BLOCKS)
  const xValueSet = new Set(xValues)
  const rows = rowsByNumber.filter((block) => xValueSet.has(block.number))

  const xIndex = new Map(xValues.map((value, index) => [value, index]))
  const rowByHash = new Map(rows.map((row) => [row.hash, row]))
  const primaryHead = getPrimaryHead(rows)
  const primaryHashes = new Set<string>()

  for (let row = primaryHead; row; row = rowByHash.get(row.parent) ?? null) {
    primaryHashes.add(row.hash)
  }

  const primaryLane = Array<number | null>(xValues.length).fill(null)
  for (const row of rows) {
    if (primaryHashes.has(row.hash)) {
      primaryLane[xIndex.get(row.number)!] = row.value
    }
  }

  const laneByHash = new Map<string, number>()
  const forkLanes: Array<Array<number | null>> = []

  for (const number of xValues) {
    const usedLanes = new Set<number>()
    const heightRows = rows
      .filter((row) => row.number === number)
      .sort((a, b) => a.created - b.created)

    for (const row of heightRows) {
      if (primaryHashes.has(row.hash)) continue

      const preferredLane = laneByHash.get(row.parent)
      const lane =
        preferredLane != null && !usedLanes.has(preferredLane)
          ? preferredLane
          : getFreeLane(usedLanes)
      forkLanes[lane] ??= Array(xValues.length).fill(null)

      if (preferredLane != null && lane !== preferredLane) {
        const parent = rowByHash.get(row.parent)
        const parentIndex =
          parent == null ? undefined : xIndex.get(parent.number)
        if (parent && parentIndex != null) {
          forkLanes[lane][parentIndex] = parent.value
        }
      } else if (preferredLane == null) {
        const parent = rowByHash.get(row.parent)
        const parentIndex =
          parent == null ? undefined : xIndex.get(parent.number)
        if (parent && parentIndex != null) {
          forkLanes[lane][parentIndex] = parent.value
        }
      }

      forkLanes[lane][xIndex.get(row.number)!] = row.value
      laneByHash.set(row.hash, lane)
      usedLanes.add(lane)
    }
  }

  const lanes = [primaryLane, ...forkLanes]
  const yValues = lanes.flatMap((lane) =>
    lane.filter((value): value is number => value != null),
  )

  return {
    data: [xValues, ...lanes] as uPlot.AlignedData,
    seriesCount: lanes.length,
    primaryLane: 0,
    yRange: getRobustRange(yValues),
  }
}

type ChartRow = RecentMetricBlock & { value: number }
const getPrimaryHead = (rows: ChartRow[]) =>
  rows.reduce<ChartRow | null>(
    (best, row) =>
      !best ||
      row.number > best.number ||
      (row.number === best.number && row.created > best.created)
        ? row
        : best,
    null,
  )

const getFreeLane = (used: Set<number>) => {
  for (let lane = 0; ; lane++) {
    if (!used.has(lane)) return lane
  }
}

const StatusPill: FC<{ healthy: boolean }> = ({ healthy }) => (
  <span className="inline-flex items-center gap-2 rounded-md border border-green-600/25 bg-green-600/10 px-3 py-1 text-sm font-medium text-green-700 dark:text-green-400">
    <span className="h-2 w-2 rounded-full bg-green-600" />
    {healthy ? "Live" : "Syncing"}
  </span>
)

const SummaryPair: FC<{ label: string; value: string }> = ({
  label,
  value,
}) => (
  <div className="flex items-center gap-3 border-l pl-6">
    <span className="text-muted-foreground">{label}</span>
    <span className="rounded-md border bg-muted/50 px-2 py-1 font-mono text-xs">
      {value}
    </span>
  </div>
)

const StatusRow: FC<{ label: string; value: string; accent?: boolean }> = ({
  label,
  value,
  accent,
}) => (
  <div className="flex items-center justify-between gap-4">
    <span className="text-muted-foreground">{label}</span>
    <span
      className={
        accent
          ? "font-mono text-xs font-semibold text-polkadot-500"
          : "font-medium tabular-nums"
      }
    >
      {value}
    </span>
  </div>
)

const HealthRow: FC<{ label: string; healthy: boolean }> = ({
  label,
  healthy,
}) => (
  <div className="flex items-center justify-between gap-4">
    <span className="inline-flex items-center gap-2 text-muted-foreground">
      <CheckCircle2
        className={
          healthy ? "h-4 w-4 text-green-600" : "h-4 w-4 text-muted-foreground"
        }
      />
      {label}
    </span>
    <span
      className={
        healthy
          ? "font-medium text-green-700 dark:text-green-400"
          : "font-medium text-muted-foreground"
      }
    >
      {healthy ? "Healthy" : "Pending"}
    </span>
  </div>
)

const toSeconds = (value: number | null) =>
  value == null ? null : Math.max(0, value / 1000)

const formatInteger = (value: number | null | undefined) =>
  value == null || !Number.isFinite(value)
    ? "-"
    : Math.round(value).toLocaleString()

const formatBlockNumber = (value: number | null | undefined) =>
  value == null ? "-" : `#${value.toLocaleString()}`

const formatDuration = (value: number | null | undefined) =>
  value == null || !Number.isFinite(value)
    ? "-"
    : `${(value / 1000).toFixed(1)}s`

const formatPercent = (value: number | null | undefined) =>
  value == null || !Number.isFinite(value) ? "-" : `${Math.round(value)}%`

const formatAge = (value: number) => {
  if (value < 1000) return "now"
  return `${Math.round(value / 1000)}s ago`
}

const nodeStatusText = (health: { isSyncing: boolean; peers: number }) => {
  if (health.isSyncing) return "node syncing"
  if (health.peers === 0) return "no peers"
  return "node healthy"
}

const withAlpha = (hex: string, alpha: number) => {
  const value = hex.replace("#", "")
  const r = Number.parseInt(value.slice(0, 2), 16)
  const g = Number.parseInt(value.slice(2, 4), 16)
  const b = Number.parseInt(value.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

const getRobustRange = (values: number[]): [number, number] => {
  const sorted = values
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b)

  if (!sorted.length) return [0, 1]

  const rangeValues = getSingleOutlierTrimmedValues(sorted)
  let min = rangeValues[0]
  let max = rangeValues.at(-1)!
  const delta = max - min
  const pad = delta > 0 ? delta * 0.12 : Math.max(Math.abs(max) * 0.12, 1)

  min = min >= 0 ? Math.max(0, min - pad) : min - pad
  max += pad

  return min === max ? [min - 1, max + 1] : [min, max]
}

const getSingleOutlierTrimmedValues = (sorted: number[]) => {
  if (sorted.length < 6) return sorted

  const min = sorted[0]
  const secondMin = sorted[1]
  const secondMax = sorted.at(-2)!
  const max = sorted.at(-1)!
  const lowGap = secondMin - min
  const highGap = max - secondMax
  const rangeWithoutLow = max - secondMin
  const rangeWithoutHigh = secondMax - min

  const lowIsWayOff = isSingleEdgeOutlier(lowGap, rangeWithoutLow, secondMin)
  const highIsWayOff = isSingleEdgeOutlier(highGap, rangeWithoutHigh, secondMax)

  if (highIsWayOff && (!lowIsWayOff || highGap >= lowGap)) {
    return sorted.slice(0, -1)
  }
  if (lowIsWayOff) {
    return sorted.slice(1)
  }

  return sorted
}

const isSingleEdgeOutlier = (
  edgeGap: number,
  remainingRange: number,
  neighbor: number,
) => edgeGap > Math.max(remainingRange * 4, Math.abs(neighbor) * 0.5, 1)

const formatAxisValue = (value: number) => {
  if (Math.abs(value) >= 1000) return formatCompactAxisValue(value)
  return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(1)
}

const getAxisSplits = (min: number, max: number, increment: number) => {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return []

  let currentIncrement = increment
  let splits = getSplitsForIncrement(min, max, currentIncrement)

  while (splits.length < 2 && currentIncrement > 0) {
    currentIncrement /= 2
    splits = getSplitsForIncrement(min, max, currentIncrement)
  }

  return splits
}

const getSplitsForIncrement = (min: number, max: number, increment: number) => {
  if (!Number.isFinite(increment) || increment <= 0) return []

  const precision = Math.max(0, Math.ceil(-Math.log10(increment)) + 2)
  const result: number[] = []

  for (
    let value = Math.ceil(min / increment) * increment;
    value <= max;
    value += increment
  ) {
    result.push(Number(value.toFixed(precision)))
  }

  return result
}

const formatCompactAxisValue = (value: number) => {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}k`
  if (abs >= 100) return Math.round(value).toLocaleString()
  if (abs >= 10) return value.toFixed(0)
  return value.toFixed(1)
}
