import { JsonDisplay } from "@/components/JsonDisplay"
import type { DefaultedStateObservable } from "@react-rxjs/core"
import { useStateObservable } from "@react-rxjs/core"
import { FC } from "react"
import type { RuntimeCallResult } from "./runtimeCalls.state"

export type RuntimeCallWorkspaceContext = {
  api: string
  method: string
  result$: DefaultedStateObservable<RuntimeCallResult | null>
}

export const RuntimeCallWorkspaceEntry: FC<{
  context: RuntimeCallWorkspaceContext
}> = ({ context }) => {
  const result = useStateObservable(context.result$)

  if (!result) {
    return <div className="p-3 text-sm text-muted-foreground">Loading...</div>
  }

  return (
    <div className="p-3 text-sm">
      <JsonDisplay src={result.value} />
    </div>
  )
}
