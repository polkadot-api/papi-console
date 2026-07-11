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
import { Enum } from "polkadot-api"

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
  branched: number | null
  branches: number[]
}

const positionContiguousBlocks = (
  blocks: Record<number, Map<string, BlockInfo>>,
  startHeight: number,
  best: string,
) => {
  // We need a way to decide on the lanes each block will take.
  // If we go in increasing block number, then we might find forks that push previously-set lanes.
  // If we go in decreasing block number, then we don't know which fork was "the original" and lanes won't be stable.
  // The idea here is to do two passes. An increasing block number sets a "score" that holds the information of the block tree.
  // Then a decreasing block number sets the lanes, using that score as a means to
  const blockScore = new Map<string, [number, number]>()
  const getBlockScore = (hash: string) => {
    const score = blockScore.get(hash)
    if (!score) throw new Error("Block not scored")
    return score[0] / 2 + score[1] / 2
  }
  // Sorted in increasing height and discovery
  const sortedBlocks: BlockInfo[][] = []

  const initialBlocks = [...(blocks[startHeight]?.values() ?? [])]
  if (!initialBlocks.length) throw new Error("Requires one block")
  const initialRange = Number.MAX_SAFE_INTEGER / initialBlocks.length
  initialBlocks
    .sort((a, b) => a.discoveredAt - b.discoveredAt)
    .forEach((block, i) => {
      blockScore.set(block.hash, [i * initialRange, (i + 1) * initialRange])
    })
  sortedBlocks.push(initialBlocks)

  let h = startHeight + 1
  for (; blocks[h]?.size; h++) {
    const blocksByParent: Record<string, BlockInfo[]> = {}
    blocks[h].forEach((block) => {
      blocksByParent[block.parent] = [
        ...(blocksByParent[block.parent] || []),
        block,
      ]
    })
    for (const parent in blocksByParent) {
      const parentScore = blockScore.get(parent)
      if (!parentScore) throw new Error("Parent doesn't exist")
      const range =
        (parentScore[1] - parentScore[0]) / blocksByParent[parent].length
      blocksByParent[parent].sort((a, b) => a.discoveredAt - b.discoveredAt)
      blocksByParent[parent].forEach((block, i) => {
        blockScore.set(block.hash, [
          parentScore[0] + i * range,
          parentScore[0] + (i + 1) * range,
        ])
      })
    }
    // TODO this is not fully sorted.
    sortedBlocks.push(Object.values(blocksByParent).flat())
  }
  const lastHeight = h - 1

  let canonicalHash = best
  interface Lane {
    block: BlockInfo
    pos: number // Vertical position
    canonical: boolean
  }

  sortedBlocks.reverse()
  const lanesByHeight: Array<Array<Lane | null>> = []
  for (const blocks of sortedBlocks) {
    const blockToPos = Object.fromEntries(
      blocks.map((block, i) => [block.hash, i]),
    )
    const blockToLane = (block: BlockInfo): Lane => {
      const canonical = canonicalHash === block.hash
      if (canonical) canonicalHash = block.parent
      return {
        block,
        canonical,
        pos: blockToPos[block.hash],
      }
    }
    blocks.sort((a, b) => getBlockScore(a.hash) - getBlockScore(b.hash))
    const prevLanes = lanesByHeight.at(-1)
    if (!prevLanes) {
      lanesByHeight.push(blocks.map(blockToLane))
      continue
    }

    // We're restricted to the previous lanes: Put each block underneath the first children
    const lanes: Array<Lane | null> = []
    for (const block of blocks) {
      let i = lanes.length
      while (
        i < prevLanes.length &&
        prevLanes[i]?.block.parent !== block.hash
      ) {
        i++
      }
      // Always collapse the lanes to the left: so initial lane can never be empty.
      if (i !== prevLanes.length && lanes.length) {
        // The lane was found, so align it with the previous lane
        lanes.push(...new Array(i - lanes.length).fill(null))
        // Otherwise we must preserve the ordering set by blockScore, so in that case we don't offset the lanes.
      }
      lanes.push(blockToLane(block))
    }
    lanesByHeight.push(lanes)
  }

  // Now that we have every block in their position and lanes connected, we're
  // ready to render the tree by deciding how to connect each node.
  interface TableLine {
    cells: Array<
      Enum<{
        block: {
          // whether the children are forked into left / vertical / right
          child: Array<"l" | "v" | "r">
          // whether the parent comes from left / vertical / right
          parent?: "l" | "v" | "r"
        }
        line: {
          // Whether it has a corner from left to up / right to up / up to left / up to right
          corner: Array<"lu" | "ru" | "ul" | "ur">
          // Whether it has a vertical / horizontal line
          line?: "v" | "h"
          // Whether to squeeze it up the cell (connects with a block in the same row)
          squeeze: boolean
        }
      }>
    >
  }

  let prevHashes: Array<string | null> | null = null
  const tableLines: TableLine[] = []
  for (const lanes of lanesByHeight) {
    const lineToLane = lanes
      .map((lane, idx) => ({ lane: lane!, idx }))
      .filter((v) => v.lane !== null)
      .sort((a, b) => a.lane.pos - b.lane.pos)
      .map(({ idx }) => idx)
    if (!prevHashes) {
    }
  }
}
const positionBlocks = (
  blocks: Record<number, Map<string, BlockInfo>>,
  best: string,
) => {
  const heights = Object.keys(blocks).map((v) => Number(v))

  positionContiguousBlocks(blocks, heights[0], best)
}

const blockTable$ = state(
  combineLatest([blocksByHeight$, best$]).pipe(
    debounceTime(0),
    map(([blocks, best]) => {
      const result: Array<PositionedBlock> = []

      const blockPositions: Record<string, number> = {}
      const positionsTaken = new Set<number>()
      const getFreePosition = () => {
        for (let i = 0; ; i++) {
          if (!positionsTaken.has(i)) {
            return i
          }
        }
      }
      for (let height = best.number; blocks[height]; height--) {
        const competingBlocks = [...blocks[height].values()]
        if (competingBlocks.length > 1) {
          if (height === best.number) {
            competingBlocks.sort((a) => (a.hash === best.hash ? -1 : 1))
          } else {
            competingBlocks.sort((a, b) =>
              (blockPositions[a.hash] ?? Number.POSITIVE_INFINITY) <
              (blockPositions[b.hash] ?? Number.POSITIVE_INFINITY)
                ? -1
                : 1,
            )
          }
        }
        competingBlocks.forEach((block) => {
          const branches = [...positionsTaken]

          const position = blockPositions[block.hash] ?? getFreePosition()
          if (blockPositions[block.parent] != null) {
            // then it means the parent was already discovered by a previous
            // so this is the start of a branch
            result.push({
              block,
              branched: blockPositions[block.parent],
              branches,
              position,
            })
            positionsTaken.delete(position)
          } else {
            // We put our parent underneath us
            blockPositions[block.parent] = position
            positionsTaken.add(position)
            result.push({
              block,
              branched: null,
              branches,
              position,
            })
          }
        })
      }

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
            firstInGroup={row.position === 0}
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
                      row.position === 0
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

const CELL_WIDTH = 20
const CELL_HEIGHT = 40
const CIRCLE_R = 5
const ForkRenderer: FC<{ row: PositionedBlock }> = ({ row }) => {
  const totalCells = Math.max(row.position, ...row.branches) + 1

  const getPositionCenter = (p: number) => CELL_WIDTH * p + CELL_WIDTH / 2

  return (
    <svg
      height={CELL_HEIGHT}
      width={CELL_WIDTH * totalCells}
      className="stroke-card-foreground/60"
    >
      {row.branches.map((branch, i) => (
        <line
          key={i}
          x1={getPositionCenter(branch)}
          y1={0}
          x2={getPositionCenter(branch)}
          y2={
            row.branched != null && branch === row.position
              ? CELL_HEIGHT / 2
              : CELL_HEIGHT
          }
        />
      ))}
      {row.branched != null ? (
        <line
          x1={getPositionCenter(row.branched)}
          y1={CELL_HEIGHT / 2}
          x2={getPositionCenter(row.position)}
          y2={CELL_HEIGHT / 2}
        />
      ) : row.branches.includes(row.position) ? null : (
        <line
          x1={getPositionCenter(row.position)}
          y1={CELL_HEIGHT / 2}
          x2={getPositionCenter(row.position)}
          y2={CELL_HEIGHT}
        />
      )}
      <circle
        cx={getPositionCenter(row.position)}
        cy={CELL_HEIGHT / 2}
        r={CIRCLE_R}
        className={
          row.position === 0 ? "fill-polkadot-500" : "fill-polkadot-600"
        }
      />
    </svg>
  )
}
