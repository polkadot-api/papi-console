import { CopyText } from "@/components/Copy"
import { Popover } from "@/components/Popover"
import { Link } from "@/hashParams"
import { BlockInfo, blocksByHeight$, finalized$ } from "@/state/block.state"
import { client$ } from "@/state/chains/chain.state"
import { state, useStateObservable } from "@react-rxjs/core"
import { FC } from "react"
import { combineLatest, debounceTime, map, repeat, switchMap } from "rxjs"
import { twMerge } from "tailwind-merge"
import { BlockPopover } from "./BlockPopover"
import * as Finalizing from "./FinalizingTable"

const best$ = client$.pipeState(
  switchMap((client) =>
    client.bestBlocks$.pipe(
      repeat(),
      map(([best]) => best),
    ),
  ),
)

interface PositionedBlock {
  block: BlockInfo
  position: number
  paths: ForkPath[]
  pathPositions: number[]
  totalCells: number
  isCanonical: boolean
}

interface ForkPath {
  d: string
}

interface PositionedEdge {
  childIndex: number
  parentIndex: number
  lane: number
  isCanonical: boolean
}

const CELL_WIDTH = 20
const CELL_HEIGHT = 40
const CIRCLE_R = 5
const CORNER_R = 5

const getPositionCenter = (p: number) => CELL_WIDTH * p + CELL_WIDTH / 2

const getContiguousHeights = (
  blocks: Record<number, Map<string, BlockInfo>>,
  bestNumber: number,
) => {
  const heights: number[] = []
  for (let height = bestNumber; blocks[height]; height--) {
    heights.push(height)
  }
  return heights
}

const getBlockPositions = (
  blocks: Record<number, Map<string, BlockInfo>>,
  heights: number[],
) => {
  const blockPositions: Record<string, number> = {}
  const ascendingHeights = [...heights].reverse()

  ascendingHeights.forEach((height, i) => {
    const competingBlocks = [...blocks[height].values()]

    if (i === 0) {
      competingBlocks.forEach((block, position) => {
        blockPositions[block.hash] = position
      })
      return
    }

    const previousBlocks = blocks[ascendingHeights[i - 1]]
    const childrenByParent = new Map<string, BlockInfo[]>()
    const blocksWithoutVisibleParent: BlockInfo[] = []

    competingBlocks.forEach((block) => {
      if (!previousBlocks.has(block.parent)) {
        blocksWithoutVisibleParent.push(block)
        return
      }

      const children = childrenByParent.get(block.parent) ?? []
      children.push(block)
      childrenByParent.set(block.parent, children)
    })

    let nextPosition = 0
    const parentsWithChildren = [...previousBlocks.values()]
      .filter((block) => childrenByParent.has(block.hash))
      .sort((a, b) => blockPositions[a.hash] - blockPositions[b.hash])

    parentsWithChildren.forEach((block) => {
      childrenByParent.get(block.hash)!.forEach((child) => {
        blockPositions[child.hash] = nextPosition++
      })
    })

    blocksWithoutVisibleParent.forEach((block) => {
      blockPositions[block.hash] = nextPosition++
    })
  })

  return blockPositions
}

const getBlocksByHash = (
  blocks: Record<number, Map<string, BlockInfo>>,
  heights: number[],
) =>
  new Map(
    heights.flatMap((height) =>
      [...blocks[height].values()].map((block) => [block.hash, block] as const),
    ),
  )

const getCanonicalBlocks = (
  blocks: Record<number, Map<string, BlockInfo>>,
  heights: number[],
  bestHash: string,
) => {
  const blocksByHash = getBlocksByHash(blocks, heights)
  const canonicalBlocks = new Set<string>()

  for (
    let block = blocksByHash.get(bestHash);
    block;
    block = blocksByHash.get(block.parent)
  ) {
    canonicalBlocks.add(block.hash)
  }

  return canonicalBlocks
}

const getRenderBlocks = (
  blocks: Record<number, Map<string, BlockInfo>>,
  heights: number[],
) => heights.flatMap((height) => [...blocks[height].values()].reverse())

const getVerticalPath = (position: number, y1: number, y2: number) => {
  const x = getPositionCenter(position)
  return `M ${x} ${y1} L ${x} ${y2}`
}

const getChildPath = (blockPosition: number, lane: number) => {
  const blockX = getPositionCenter(blockPosition)
  const laneX = getPositionCenter(lane)
  if (blockPosition === lane) {
    return `M ${blockX} ${CELL_HEIGHT / 2} L ${blockX} ${CELL_HEIGHT}`
  }

  const direction = Math.sign(laneX - blockX)
  const radius = Math.min(CORNER_R, Math.abs(laneX - blockX) / 2)

  return [
    `M ${blockX} ${CELL_HEIGHT / 2}`,
    `L ${blockX} ${CELL_HEIGHT - radius}`,
    `Q ${blockX} ${CELL_HEIGHT} ${blockX + direction * radius} ${CELL_HEIGHT}`,
    `L ${laneX} ${CELL_HEIGHT}`,
  ].join(" ")
}

const getParentStemPath = (parentPosition: number, y: number) => {
  const parentX = getPositionCenter(parentPosition)
  const parentTop = CELL_HEIGHT / 2 - CIRCLE_R

  return `M ${parentX} ${parentTop} L ${parentX} ${y}`
}

const getParentContinuationPath = (parentPosition: number) => {
  const parentX = getPositionCenter(parentPosition)
  const parentTop = CELL_HEIGHT / 2 - CIRCLE_R

  return `M ${parentX} 0 L ${parentX} ${parentTop}`
}

const getParentLanePath = (lane: number, parentPosition: number, y: number) => {
  const laneX = getPositionCenter(lane)
  const parentX = getPositionCenter(parentPosition)

  return `M ${laneX} 0 L ${laneX} ${y} L ${parentX} ${y}`
}

const addPath = (row: PositionedBlock, d: string, pathPositions: number[]) => {
  if (row.paths.some((path) => path.d === d)) return
  row.paths.push({ d })
  row.pathPositions.push(...pathPositions)
}

const addParentFork = (
  row: PositionedBlock,
  parentPosition: number,
  lanes: number[],
) => {
  const childLanes = [...new Set(lanes)].sort((a, b) => a - b)
  if (!childLanes.length) return

  if (childLanes.includes(parentPosition)) {
    addPath(row, getParentContinuationPath(parentPosition), [parentPosition])
  }

  const sideLanes = childLanes
    .filter((lane) => lane !== parentPosition)
    .sort((a, b) => Math.abs(a - parentPosition) - Math.abs(b - parentPosition))
  if (!sideLanes.length) return

  const parentTop = CELL_HEIGHT / 2 - CIRCLE_R
  const firstForkY = CIRCLE_R + 1
  const lastForkY = parentTop - 1
  const getForkY = (index: number) =>
    sideLanes.length === 1
      ? CIRCLE_R + CORNER_R
      : firstForkY + ((lastForkY - firstForkY) * index) / (sideLanes.length - 1)
  const forkYs = sideLanes.map((_, index) => getForkY(index))

  if (!childLanes.includes(parentPosition)) {
    addPath(row, getParentStemPath(parentPosition, Math.min(...forkYs)), [
      parentPosition,
    ])
  }

  sideLanes.forEach((lane, index) => {
    addPath(row, getParentLanePath(lane, parentPosition, forkYs[index]), [
      lane,
      parentPosition,
    ])
  })
}

const edgeSpansOverlap = (
  a: Pick<PositionedEdge, "childIndex" | "parentIndex">,
  b: Pick<PositionedEdge, "childIndex" | "parentIndex">,
) => {
  return a.childIndex < b.parentIndex && b.childIndex < a.parentIndex
}

const compareEdgeOrder = (
  a: Pick<PositionedEdge, "childIndex" | "parentIndex">,
  b: Pick<PositionedEdge, "childIndex" | "parentIndex">,
) => {
  if (a.parentIndex !== b.parentIndex) return b.parentIndex - a.parentIndex
  return a.childIndex - b.childIndex
}

const getEdgeLanes = (
  edges: Array<Omit<PositionedEdge, "lane">>,
): PositionedEdge[] =>
  edges.map((edge) => ({
    ...edge,
    // Overlapping fork edges must keep the same left-to-right order for their
    // full span. Lower-parent forks stay left; earlier/outer overlapping
    // branches are pushed right instead of crossing back through them.
    lane: edge.isCanonical
      ? 0
      : 1 +
        edges.filter(
          (other) =>
            !other.isCanonical &&
            edgeSpansOverlap(edge, other) &&
            compareEdgeOrder(other, edge) < 0,
        ).length,
  }))

const blockTable$ = state(
  combineLatest([blocksByHeight$, best$]).pipe(
    debounceTime(0),
    map(([blocks, best]) => {
      const heights = getContiguousHeights(blocks, best.number)
      const blockPositions = getBlockPositions(blocks, heights)
      const canonicalBlocks = getCanonicalBlocks(blocks, heights, best.hash)
      const result: PositionedBlock[] = getRenderBlocks(blocks, heights).map(
        (block) => ({
          block,
          position: blockPositions[block.hash],
          paths: [],
          pathPositions: [],
          totalCells: 1,
          isCanonical: canonicalBlocks.has(block.hash),
        }),
      )
      const rowIndexes = new Map(
        result.map((row, index) => [row.block.hash, index]),
      )

      const edges = getEdgeLanes(
        result.flatMap((row, childIndex) => {
          const parentIndex = rowIndexes.get(row.block.parent)
          if (parentIndex == null) return []

          return [
            {
              childIndex,
              parentIndex,
              isCanonical: row.isCanonical,
            },
          ]
        }),
      )
      const outgoingEdges = new Map(
        edges.map((edge) => [edge.childIndex, edge.lane]),
      )

      result.forEach((row, index) => {
        row.position =
          outgoingEdges.get(index) ??
          (row.isCanonical ? 0 : Math.max(1, row.position))
      })

      edges.forEach((edge) => {
        const row = result[edge.childIndex]

        addPath(row, getChildPath(row.position, edge.lane), [
          row.position,
          edge.lane,
        ])

        for (let i = edge.childIndex + 1; i < edge.parentIndex; i++) {
          addPath(result[i], getVerticalPath(edge.lane, 0, CELL_HEIGHT), [
            edge.lane,
          ])
        }
      })

      const edgesByParent = new Map<number, PositionedEdge[]>()
      edges.forEach((edge) => {
        const parentEdges = edgesByParent.get(edge.parentIndex) ?? []
        parentEdges.push(edge)
        edgesByParent.set(edge.parentIndex, parentEdges)
      })

      edgesByParent.forEach((parentEdges, parentIndex) => {
        const parent = result[parentIndex]
        addParentFork(
          parent,
          parent.position,
          parentEdges.map((edge) => edge.lane),
        )
      })

      const totalCells =
        result.reduce((max, row) => {
          return Math.max(max, row.position, ...row.pathPositions)
        }, 0) + 1

      result.forEach((row) => {
        row.totalCells = totalCells
        row.pathPositions.sort((a, b) => a - b)
      })

      return result
    }),
  ),
  [],
)

export const BlockTable = () => {
  const rows = useStateObservable(blockTable$)
  const finalized = useStateObservable(finalized$)

  const numberSpan = (idx: number) => {
    const initialIdx = idx
    const number = rows[idx].block.number
    do {
      idx++
    } while (number === rows[idx]?.block.number)
    return idx - initialIdx
  }
  if (!finalized) return null

  return (
    <Finalizing.Root>
      <Finalizing.Title>Recent Blocks</Finalizing.Title>
      <Finalizing.Table>
        {rows.map((row, i) => (
          <Finalizing.Row
            key={row.block.hash}
            number={row.block.number}
            finalized={finalized.number}
            firstInGroup={rows[i - 1]?.block.number !== row.block.number}
            idx={i}
          >
            {rows[i - 1]?.block.number !== row.block.number ? (
              <td
                rowSpan={numberSpan(i)}
                className={twMerge(
                  "px-2",
                  numberSpan(i) > 1
                    ? twMerge(
                        i > 0 ? "border-y" : "border-b",
                        "border-card-foreground/25",
                      )
                    : null,
                  row.block.number === finalized.number &&
                    "border-t-card-foreground/50",
                  row.block.number === finalized.number + 1 &&
                    "border-b-card-foreground/50",
                )}
              >
                <Link to={`/explorer/${row.block.hash}`}>
                  {row.block.number.toLocaleString()}
                </Link>
              </td>
            ) : null}
            <td className="p-0">
              <ForkRenderer row={row} />
            </td>
            <td className="max-w-xs w-full">
              <div className="flex gap-1 pr-1">
                <Popover content={<BlockPopover hash={row.block.hash} />}>
                  <button
                    className={twMerge(
                      "overflow-hidden text-ellipsis whitespace-nowrap font-mono text-sm",
                      "text-card-foreground/80 hover:text-card-foreground",
                      row.isCanonical
                        ? ""
                        : row.block.number > finalized.number
                          ? "opacity-80"
                          : "opacity-50",
                    )}
                  >
                    {row.block.hash}
                  </button>
                </Popover>
                <CopyText text={row.block.hash} binary />
              </div>
            </td>
          </Finalizing.Row>
        ))}
      </Finalizing.Table>
    </Finalizing.Root>
  )
}

const ForkRenderer: FC<{ row: PositionedBlock }> = ({ row }) => {
  return (
    <svg
      height={CELL_HEIGHT}
      width={CELL_WIDTH * row.totalCells}
      className="stroke-card-foreground/60"
    >
      {row.paths.map((path, i) => (
        <path
          key={i}
          d={path.d}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      <circle
        cx={getPositionCenter(row.position)}
        cy={CELL_HEIGHT / 2}
        r={CIRCLE_R}
        className={row.isCanonical ? "fill-polkadot-500" : "fill-polkadot-600"}
      />
    </svg>
  )
}
