import { FC, useState } from "react"
import { BlockInfo } from "../block.state"
import { groupBy } from "@/lib/groupBy"
import { EventDisplay } from "./Extrinsic"
import { SystemEvent } from "@polkadot-api/observable-client"
import { ExpandBtn } from "@/components/Expand"

export const BlockEvents: FC<{
  block: BlockInfo
}> = ({ block }) => {
  const groups = groupBy(block.events ?? [], (v) => v.phase.type)

  return (
    <div className="space-y-2">
      <EventGroup
        title="Initialization"
        group={groups.Initialization}
        defaultExpanded
      />
      <EventGroup title="Apply Extrinsic" group={groups.ApplyExtrinsic} />
      <EventGroup
        title="Finalization"
        group={groups.Finalization}
        defaultExpanded
      />
    </div>
  )
}

const EventGroup: FC<{
  title: string
  group: SystemEvent[] | undefined
  defaultExpanded?: boolean
}> = ({ title, group, defaultExpanded }) => {
  const [expanded, setExpanded] = useState(defaultExpanded ?? !group?.length)

  return (
    <div className="border rounded bg-card text-card-foreground">
      <div className="flex justify-between items-center bg-card sticky top-0 p-2">
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex gap-1 items-center"
        >
          <ExpandBtn expanded={expanded} />
          {title}
        </button>
      </div>
      {expanded ? (
        group?.length ? (
          <ol className="px-2 pb-2">
            {group.map((evt, index) => (
              <EventDisplay key={index} index={index} evt={evt} />
            ))}
          </ol>
        ) : (
          <div className="px-2 pb-2 text-muted-foreground">No Events</div>
        )
      ) : null}
    </div>
  )
}
