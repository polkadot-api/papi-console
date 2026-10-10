import type { BlockInfo } from "@/state/block.state"

export interface PositionedBlock {
  block: BlockInfo
  /** Lane of the block, 0 being the leftmost one */
  position: number
  /** Lane of the parent, or null when the parent is not in the table */
  parentPosition: number | null
  /** Whether a block in the table builds on top of this one */
  hasChildren: boolean
  /** Lanes with a line crossing this row from a child above to a parent below */
  passThrough: number[]
  /** Whether the block is part of the best chain */
  canonical: boolean
}

/**
 * Places recent blocks in lanes so that a block keeps its lane as new blocks
 * arrive, instead of the lanes swapping when a fork overtakes the best block.
 *
 * Blocks are placed bottom-up, oldest first:
 * - A block keeps its parent's lane if it's the first child discovered for
 *   that parent (blocks of the same height come in discovery order).
 * - Other children branch out to a free lane on the right of their parent.
 * - A best-chain block moves back to the leftmost free lane, so when a fork
 *   wins it returns to the left as soon as the branch that held that lane
 *   stops.
 *
 * Each height is visited once and lanes are scanned linearly, so the cost
 * grows with the number of blocks shown.
 */
export function layoutBlocks(
  blocksByHeight: Record<number, Map<string, BlockInfo>>,
  best: { hash: string; number: number },
): PositionedBlock[] {
  if (!blocksByHeight[best.number]) return []

  // Same range as before: from the best block down while there are blocks.
  let bottom = best.number
  while (blocksByHeight[bottom - 1]) bottom--

  const canonical = new Set<string>()
  let hash: string | undefined = best.hash
  for (let height = best.number; height >= bottom; height--) {
    const block: BlockInfo | undefined =
      hash != null ? blocksByHeight[height].get(hash) : undefined
    if (!block) break
    canonical.add(block.hash)
    hash = block.parent
  }

  const laneOf = new Map<string, number>()
  const withChildren = new Set<string>()

  for (let height = bottom; height <= best.number; height++) {
    const blocks = [...blocksByHeight[height].values()]
    const taken = new Set<number>()
    const lanes = new Map<string, number>()

    const firstChildPlaced = new Set<string>()
    for (const block of blocks) {
      const parentLane = laneOf.get(block.parent)
      if (parentLane != null && !firstChildPlaced.has(block.parent)) {
        firstChildPlaced.add(block.parent)
        lanes.set(block.hash, parentLane)
        taken.add(parentLane)
      }
    }

    const branching = blocks
      .filter((block) => !lanes.has(block.hash))
      // Without a parent in the table, the best chain claims the left first.
      .sort(
        (a, b) => Number(canonical.has(b.hash)) - Number(canonical.has(a.hash)),
      )
    for (const block of branching) {
      const parentLane = laneOf.get(block.parent)
      let lane = parentLane != null ? parentLane + 1 : 0
      while (taken.has(lane)) lane++
      lanes.set(block.hash, lane)
      taken.add(lane)
    }

    for (const block of blocks) {
      if (!canonical.has(block.hash)) continue
      const current = lanes.get(block.hash)!
      let lane = 0
      while (lane < current && taken.has(lane)) lane++
      if (lane < current) {
        taken.delete(current)
        taken.add(lane)
        lanes.set(block.hash, lane)
      }
    }

    for (const block of blocks) {
      laneOf.set(block.hash, lanes.get(block.hash)!)
      if (laneOf.has(block.parent)) withChildren.add(block.parent)
    }
  }

  const rows: PositionedBlock[] = []
  const rowOf = new Map<string, number>()
  for (let height = best.number; height >= bottom; height--) {
    const blocks = [...blocksByHeight[height].values()].sort(
      (a, b) => laneOf.get(a.hash)! - laneOf.get(b.hash)!,
    )
    for (const block of blocks) {
      rowOf.set(block.hash, rows.length)
      rows.push({
        block,
        position: laneOf.get(block.hash)!,
        parentPosition: laneOf.get(block.parent) ?? null,
        hasChildren: withChildren.has(block.hash),
        passThrough: [],
        canonical: canonical.has(block.hash),
      })
    }
  }

  // The line from a block to its parent leaves the block's row at the
  // parent's lane and crosses every row in between.
  rows.forEach((row, childRow) => {
    const parentRow = rowOf.get(row.block.parent)
    if (parentRow == null || row.parentPosition == null) return
    for (let r = childRow + 1; r < parentRow; r++) {
      rows[r].passThrough.push(row.parentPosition)
    }
  })

  return rows
}
