import { FC, useEffect, useMemo, useRef } from "react"
import uPlot from "uplot"
import "uplot/dist/uPlot.min.css"
import type { BlockMap, RecentMetricBlock } from "./metrics.state"
import { WINDOW_SIZE } from "./metrics.state"

export function ForkChart<T>({
  blocks,
  select,
  color,
}: {
  blocks: BlockMap<T> | null
  select: (block: T) => number | null
  color: string
}) {
  const chart = useMemo(
    () => (blocks ? buildForkChartData(blocks, select) : null),
    [blocks, select],
  )

  if (!chart?.data[0].length) {
    return <div className="h-full min-h-16 rounded bg-muted/30" />
  }

  return (
    <UPlotChart
      data={chart.data}
      seriesCount={chart.seriesCount}
      primaryLane={chart.primaryLane}
      yRange={chart.yRange}
      color={color}
      height={112}
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
}> = ({ data, seriesCount, primaryLane, yRange, color, height }) => {
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
  }, [color, data, height, primaryLane, seriesCount, yRange])

  return <div ref={ref} className="h-full min-h-16 w-full [&_.uplot]:w-full" />
}

const getChartOptions = ({
  width,
  height,
  seriesCount,
  primaryLane,
  yRange,
  color,
}: {
  width: number
  height: number
  seriesCount: number
  primaryLane: number
  yRange: [number, number]
  color: string
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
      size: 34,
      gap: 3,
      stroke: "rgba(100,116,139,0.75)",
      grid: { stroke: "rgba(148,163,184,0.16)", width: 1 },
      ticks: { show: false },
      border: { show: false },
      splits: (_plot, _axisIdx, scaleMin, scaleMax, foundIncr) =>
        getAxisSplits(scaleMin, scaleMax, foundIncr),
      values: (_u, values) => values.map(formatCompactAxisValue),
    },
  ],
  series: [
    {},
    ...Array.from({ length: seriesCount }, (_, index) => ({
      stroke: index === primaryLane ? color : withAlpha(color, 0.5),
      width: index === primaryLane ? 2 : 1.5,
      points: { show: false },
      spanGaps: false,
    })),
  ],
})

const buildForkChartData = <T,>(
  blocks: BlockMap<T>,
  select: (block: T) => number | null,
) => {
  const rowsByNumber = blocks
    .map((block) => ({ ...block, value: select(block) }))
    .filter((block): block is RecentMetricBlock & { value: number } =>
      Number.isFinite(block.value),
    )
    .sort((a, b) => a.number - b.number || a.created - b.created)

  const xValues = [...new Set(rowsByNumber.map((block) => block.number))]
    .sort((a, b) => a - b)
    .slice(-WINDOW_SIZE)
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
