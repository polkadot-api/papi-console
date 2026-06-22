import { mapObject } from "polkadot-api/utils"
import { useMemo } from "react"
import uPlot from "uplot"
import { getYRange, UPlotChart } from "./DataChart"
import type { BlockMap } from "./metrics.state"
import { WINDOW_SIZE } from "./metrics.state"

export function ForkChart<T extends { parent: string }>({
  blocks,
  select,
  color,
}: {
  blocks: BlockMap<T> | null
  select: (block: T) => number | null
  color: string
}) {
  const chart = useMemo(() => {
    if (!blocks) return null
    const result = buildForkChartData(blocks, select)
    return result
  }, [blocks, select])

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

const buildForkChartData = <T extends { parent: string }>(
  blocks: BlockMap<T>,
  select: (block: T) => number | null,
) => {
  // We'll work in reverse order in order to ensure that the primaryLane is the longest one.
  const forks: Array<{ data: Array<number | null>; parent: string }> = []
  const primaryLane: { data: Array<number | null>; parent: string } = {
    data: [],
    parent: "",
  }

  let initialEmpty = 0
  for (let i = 0; i < WINDOW_SIZE + initialEmpty && i < 2 * WINDOW_SIZE; i++) {
    const blocksAtHeight = blocks.at(-(i + 1))
    if (!blocksAtHeight) break

    const blockValues = mapObject(blocksAtHeight, select)
    // Exclude first empty values to prevent the chart from continuously moving backwards
    if (
      !primaryLane.parent &&
      !Object.values(blockValues).some((v) => v !== null)
    ) {
      initialEmpty++
      continue
    }

    if (!primaryLane.parent) {
      // Arbitrary select one block. Ideally we would select the actual best, but at this point this isn't important.
      const [first, ...others] = Object.values(blocksAtHeight)
      if (first) {
        primaryLane.data = [select(first)]
        primaryLane.parent = first.parent
      }
      others.forEach((other) => {
        forks.push({
          data: [select(other)],
          parent: other.parent,
        })
      })
      continue
    }
    const primaryParent = blocksAtHeight[primaryLane.parent]
    // Found a discontinuity: Stop rendering the chart as we can't know where forks follow through
    if (!primaryParent) break

    const newForks = new Set(Object.keys(blocksAtHeight))

    forks.forEach((fork) => {
      if (!fork.parent) {
        // Push null value to keep it aligned
        fork.data.push(null)
        return
      }

      newForks.delete(fork.parent)
      fork.data.push(blockValues[fork.parent])
      if (fork.parent === primaryLane.parent) {
        // With the previous push we have it connected, mark it as done
        fork.parent = ""
      } else {
        fork.parent = blocksAtHeight[fork.parent]?.parent ?? ""
      }
    })

    newForks.delete(primaryLane.parent)
    primaryLane.data.push(blockValues[primaryLane.parent])
    primaryLane.parent = primaryParent.parent

    // Remember we are building the data from recent to old, and we'll reverse at the end for the chart
    // For this reason, we don't need to pad new forks, since the series will end at that point.
    newForks.forEach((hash) => {
      forks.push({
        data: [blockValues[hash]],
        parent: blocksAtHeight[hash].parent,
      })
    })
  }

  const xValues = primaryLane.data.map((_, i) => i)

  const lanes = [
    primaryLane.data.reverse(),
    ...forks.map((fork) => fork.data.reverse()),
  ]
  const yValues = lanes.flatMap((lane) => lane.filter((value) => value != null))

  return {
    data: [xValues, ...lanes] satisfies uPlot.AlignedData,
    seriesCount: lanes.length,
    primaryLane: 0,
    yRange: getYRange(yValues),
  }
}
