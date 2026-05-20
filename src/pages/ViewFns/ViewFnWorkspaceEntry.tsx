import { JsonDisplay } from "@/components/JsonDisplay"
import type { DefaultedStateObservable } from "@react-rxjs/core"
import { useStateObservable } from "@react-rxjs/core"
import { FC } from "react"
import type { ViewFnResult } from "./viewFns.state"

export type ViewFnWorkspaceContext = {
  pallet: string
  name: string
  result$: DefaultedStateObservable<ViewFnResult | null>
}

export const ViewFnWorkspaceEntry: FC<{
  context: ViewFnWorkspaceContext
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
