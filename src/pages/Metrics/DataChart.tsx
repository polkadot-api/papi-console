import { FC, useEffect, useMemo, useRef } from "react"
import uPlot from "uplot"
import "uplot/dist/uPlot.min.css"

export function DataChart({
  values,
  color,
}: {
  values: number[] | null
  color: string
}) {
  const chart = useMemo(() => {
    if (!values) return null
    const result = buildChartData(values)
    return result
  }, [values])

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

export const UPlotChart: FC<{
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

const buildChartData = (values: number[]) => {
  const xValues = values.map((_, i) => i)

  return {
    data: [xValues, values] satisfies uPlot.AlignedData,
    seriesCount: 1,
    primaryLane: 0,
    yRange: getYRange(values),
  }
}

const withAlpha = (hex: string, alpha: number) => {
  const value = hex.replace("#", "")
  const r = Number.parseInt(value.slice(0, 2), 16)
  const g = Number.parseInt(value.slice(2, 4), 16)
  const b = Number.parseInt(value.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

export const getYRange = (values: number[]): [number, number] => {
  const sorted = values
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b)

  let [min, max] = getOutlierTrimmedBounds(sorted)
  if (min == null || max == null) return [0, 1]

  const delta = max - min
  const pad = delta > 0 ? delta * 0.12 : Math.max(Math.abs(max) * 0.12, 1)

  min = min >= 0 ? Math.max(0, min - pad) : min - pad
  max += pad

  return min === max ? [min - 1, max + 1] : [min, max]
}

// In general, this is 1.5. However, we're cool with bigger outliers, since we
// still want to keep the chart realistic, but without causing a big-ass value from
// squishing the whole chart
const outlierFactor = 16
const getOutlierTrimmedBounds = (sorted: number[]) => {
  if (sorted.length < 6) return [sorted[0], sorted.at(-1)]

  const getPercentile = (p: number) => {
    const idx = sorted.length * p
    const diff = idx - Math.floor(idx)
    if (diff === 0) return sorted[Math.floor(idx)]
    const low = sorted[Math.floor(idx)]
    const high = sorted[Math.ceil(idx)]
    return low * (1 - diff) + high * diff
  }

  const q1 = getPercentile(1 / 4)
  const q3 = getPercentile(3 / 4)
  const iqr = Math.max(q3 - q1, 1)
  const lowBound = q1 - outlierFactor * iqr
  const highBound = q3 + outlierFactor * iqr

  const min = sorted.find((v) => v >= lowBound)
  const max = sorted.findLast((v) => v <= highBound)

  return [min, max]
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
