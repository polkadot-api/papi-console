import { CopyText } from "@/components/Copy"
import { Popover } from "@/components/Popover"
import { Link } from "@/hashParams"
import { blocksByHeight$, finalized$ } from "@/state/block.state"
import { client$ } from "@/state/chains/chain.state"
import { state, useStateObservable } from "@react-rxjs/core"
import { FC } from "react"
import { combineLatest, debounceTime, map, repeat, switchMap } from "rxjs"
import { twMerge } from "tailwind-merge"
import { BlockPopover } from "./BlockPopover"
import { layoutBlocks, PositionedBlock } from "./blockLayout"
import * as Finalizing from "./FinalizingTable"

const best$ = client$.pipeState(
  switchMap((client) =>
    client.bestBlocks$.pipe(
      repeat(),
      map(([best]) => best),
    ),
  ),
)

const blockTable$ = state(
  combineLatest([blocksByHeight$, best$]).pipe(
    debounceTime(0),
    map(([blocks, best]) => layoutBlocks(blocks, best)),
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
                      row.canonical
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
  const totalCells =
    Math.max(row.position, row.parentPosition ?? 0, ...row.passThrough) + 1

  const getPositionCenter = (p: number) => CELL_WIDTH * p + CELL_WIDTH / 2

  return (
    <svg
      height={CELL_HEIGHT}
      width={CELL_WIDTH * totalCells}
      className="stroke-card-foreground/60"
    >
      {row.passThrough.map((lane, i) => (
        <line
          key={i}
          x1={getPositionCenter(lane)}
          y1={0}
          x2={getPositionCenter(lane)}
          y2={CELL_HEIGHT}
        />
      ))}
      {row.hasChildren ? (
        <line
          x1={getPositionCenter(row.position)}
          y1={0}
          x2={getPositionCenter(row.position)}
          y2={CELL_HEIGHT / 2}
        />
      ) : null}
      <line
        x1={getPositionCenter(row.position)}
        y1={CELL_HEIGHT / 2}
        x2={getPositionCenter(row.parentPosition ?? row.position)}
        y2={CELL_HEIGHT}
      />
      <circle
        cx={getPositionCenter(row.position)}
        cy={CELL_HEIGHT / 2}
        r={CIRCLE_R}
        className={row.canonical ? "fill-polkadot-500" : "fill-polkadot-600"}
      />
    </svg>
  )
}
