import { CopyText } from "@/components/Copy"
import { Link } from "@/hashParams"
import { state, useStateObservable } from "@react-rxjs/core"
import { combineKeys } from "@react-rxjs/utils"
import { FC } from "react"
import { filter, map, startWith, switchMap, take } from "rxjs"
import {
  BlockInfo,
  blockInfoState$,
  blocksByHeight$,
  BlockState,
} from "../block.state"
import { BlockStatusIcon, statusText } from "./BlockState"

export const BlockInfoView: FC<{
  block: BlockInfo
}> = ({ block }) => (
  <div className="p-2">
    <div className="flex flex-wrap justify-between">
      <h2 className="font-bold text-xl whitespace-nowrap overflow-hidden text-ellipsis">
        Block {block.hash}
      </h2>
      <p className="text-xl">{block.number.toLocaleString()}</p>
    </div>
    <p className="flex gap-1 items-center py-1">
      Status:
      <BlockStatusIcon state={block.status} />
      {statusText[block.status]}
    </p>
    <div className="flex flex-wrap justify-between">
      <div className="flex flex-col">
        <div>Parent</div>
        <BlockLink hash={block.parent} />
      </div>
      <div className="flex flex-col items-end">
        <div>Children</div>
        <BlockChildren hash={block.hash} />
      </div>
    </div>
    {block.header && (
      <div className="text-foreground/80 py-2">
        <p>
          State root: {block.header.stateRoot.slice(0, 18)}{" "}
          <CopyText
            className="align-middle"
            text={block.header.stateRoot}
            binary
          />
        </p>
        <p>
          Extrinsic root: {block.header.extrinsicRoot.slice(0, 18)}{" "}
          <CopyText
            className="align-middle"
            text={block.header.extrinsicRoot}
            binary
          />
        </p>
      </div>
    )}
  </div>
)

const childBlocks$ = state(
  (hash: string) =>
    blockInfoState$(hash).pipe(
      filter((v) => !!v),
      take(1),
      switchMap(({ hash, number }) =>
        combineKeys(
          blocksByHeight$.pipe(
            map((v) => v[number + 1]),
            map((v) =>
              v
                ? [...v.values()]
                    .filter((block) => block.parent === hash)
                    .map((block) => block.hash)
                : [],
            ),
          ),
          (hash) =>
            blockInfoState$(hash).pipe(
              filter((v) => !!v),
              startWith({ hash }),
            ),
        ),
      ),
      map((children) =>
        [...children.values()]
          .sort((a, b) => {
            const valueOf = (v: typeof a) =>
              "status" in v ? statusValue[v.status] : 0
            return valueOf(a) - valueOf(b)
          })
          .map((v) => v.hash),
      ),
    ),
  [],
)
const statusValue: Record<BlockState, number> = {
  [BlockState.Finalized]: 3,
  [BlockState.Best]: 2,
  [BlockState.Fork]: 1,
  [BlockState.Pruned]: 0,
  [BlockState.Unknown]: -1,
}

const BlockChildren: FC<{ hash: string }> = ({ hash }) => {
  const childBlocks = useStateObservable(childBlocks$(hash))

  return childBlocks.length ? (
    <span className="inline-flex gap-2 align-middle">
      {childBlocks.map((hash) => (
        <BlockLink key={hash} hash={hash} />
      ))}
    </span>
  ) : (
    <span className="text-slate-400">N/A</span>
  )
}

const BlockLink: FC<{ hash: string }> = ({ hash }) => {
  const block = useStateObservable(blockInfoState$(hash))

  if (!block) {
    return <span className="align-middle">{hash.slice(0, 12)}…</span>
  }

  return (
    <Link
      className="text-polkadot/70 hover:text-polkadot align-middle inline-flex items-center gap-1 underline"
      to={`../${hash}`}
    >
      {<BlockStatusIcon state={block.status} size={20} />}
      {hash.slice(0, 12)}…
    </Link>
  )
}
