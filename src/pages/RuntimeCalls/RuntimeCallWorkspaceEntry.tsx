import { IconButton } from "@/components/IconButton"
import { JsonDisplay } from "@/components/JsonDisplay"
import { shortStr } from "@/utils"
import type { DefaultedStateObservable } from "@react-rxjs/core"
import { useStateObservable } from "@react-rxjs/core"
import { Radio, RefreshCw } from "lucide-react"
import { FC } from "react"
import { twMerge } from "tailwind-merge"
import type { RuntimeCallResult } from "./runtimeCalls.state"

export type RuntimeCallWorkspaceContext = {
  blockHash: string
  api: string
  method: string
  result$: DefaultedStateObservable<RuntimeCallResult | null>
  follow$: DefaultedStateObservable<boolean>
  setFollow: (follow: boolean) => void
  rerun: () => void
}

export const RuntimeCallWorkspaceEntry: FC<{
  context: RuntimeCallWorkspaceContext
}> = ({ context }) => {
  const result = useStateObservable(context.result$)
  const follow = useStateObservable(context.follow$)

  return (
    <div className="p-3 text-sm">
      <div className="flex items-center justify-between gap-2 pb-2">
        <span className="text-xs text-muted-foreground">
          {result ? `Block ${shortStr(result.blockHash, 6)}` : "Loading..."}
        </span>
        <div className="flex items-center gap-1">
          <IconButton
            tooltip="Run again at the latest best block"
            aria-label="Re-run"
            className="h-7 w-7"
            onClick={context.rerun}
          >
            <RefreshCw size={14} />
          </IconButton>
          <IconButton
            tooltip={
              follow ? "Stop following" : "Keep it updated with new best blocks"
            }
            aria-label="Follow best blocks"
            aria-pressed={follow}
            className={twMerge("h-7 w-7", follow && "text-primary")}
            onClick={() => context.setFollow(!follow)}
          >
            <Radio size={14} />
          </IconButton>
        </div>
      </div>
      {result && <JsonDisplay src={result.value} />}
    </div>
  )
}
