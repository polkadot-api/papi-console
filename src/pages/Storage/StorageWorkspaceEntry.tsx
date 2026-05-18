import { JsonDisplay } from "@/components/JsonDisplay"
import { useStateObservable } from "@react-rxjs/core"
import { FC } from "react"
import type { StorageEntryContext } from "./storage.state"

export const StorageWorkspaceEntry: FC<{
  context: StorageEntryContext
}> = ({ context }) => {
  const status = useStateObservable(context.status$)

  if (!status) {
    return <p className="text-muted-foreground p-2">Removed</p>
  }

  if (status.type === "loading") {
    return <p className="text-muted-foreground p-2">Loading</p>
  }

  if (status.type === "value") {
    return (
      <div className="text-xs p-2">
        <JsonDisplay src={status.value.payload} />
      </div>
    )
  }

  if (!status.value.length) return null
  const result = status.value[status.value.length - 1].result

  return (
    <div className="text-xs p-2">
      <JsonDisplay
        src={result.type === "error" ? result.value : result.value.payload}
      />
    </div>
  )
}
