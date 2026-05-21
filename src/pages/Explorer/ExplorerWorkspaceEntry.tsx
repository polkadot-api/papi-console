import { AddToWorkspace } from "@/components/IconButton"
import { pushWorkspaceEntry, setWorkspaceOpen } from "@/components/Workspace"
import { Link } from "@/hashParams"
import { BlockInfo, blockInfoState$ } from "@/state/block.state"
import { shortStr } from "@/utils"
import { useStateObservable } from "@react-rxjs/core"
import { GitGraph } from "lucide-react"
import { FC } from "react"
import { BlockStatusIcon, statusText } from "./Detail/BlockState"

export const AddBlockToWorkspace: FC<{ block: BlockInfo }> = ({ block }) => (
  <AddToWorkspace
    className="align-baseline ml-1"
    onClick={() => {
      pushWorkspaceEntry({
        id: `explorer:block:${block.hash}`,
        source: "Explorer",
        title: `Block #${block.number.toLocaleString()}`,
        subtitle: shortStr(block.hash, 8),
        link: `/explorer/${block.hash}`,
        icon: GitGraph,
        context: { hash: block.hash },
        content: BlockWorkspaceEntry,
      })
      setWorkspaceOpen(true)
    }}
  />
)

const BlockWorkspaceEntry: FC<{ context: { hash: string } }> = ({
  context,
}) => {
  const block = useStateObservable(blockInfoState$(context.hash))

  if (!block) {
    return (
      <div className="p-3 text-sm text-muted-foreground">Loading block...</div>
    )
  }

  return (
    <div className="space-y-3 p-3 text-sm">
      <dl className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3 gap-y-2">
        <dt className="text-muted-foreground">Status</dt>
        <dd className="flex min-w-0 items-center gap-1">
          <BlockStatusIcon state={block.status} size={16} />
          {statusText[block.status]}
        </dd>

        <dt className="text-muted-foreground">Height</dt>
        <dd>{block.number.toLocaleString()}</dd>

        <dt className="text-muted-foreground">Hash</dt>
        <dd className="flex min-w-0 items-center gap-1 font-mono">
          <Link className="truncate underline" to={`/explorer/${block.hash}`}>
            {shortStr(block.hash, 8)}
          </Link>
        </dd>

        <dt className="text-muted-foreground">Parent</dt>
        <dd className="flex min-w-0 items-center gap-1 font-mono">
          <Link className="truncate underline" to={`/explorer/${block.parent}`}>
            {shortStr(block.parent, 8)}
          </Link>
        </dd>
      </dl>
    </div>
  )
}
