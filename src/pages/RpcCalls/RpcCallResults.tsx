import { PathsRoot } from "@/codec-components/common/paths.state"
import { JsonDisplay } from "@/components/JsonDisplay"
import { useStateObservable } from "@react-rxjs/core"
import { Trash2 } from "lucide-react"
import { FC } from "react"
import {
  removeRpcCallResult,
  RpcCallResult,
  rpcCallResult$,
  rpcCallResultKeys$,
} from "./rpcCalls.state"

export const RpcCallResults: FC = () => {
  const keys = useStateObservable(rpcCallResultKeys$)

  if (!keys.length) return null

  return (
    <div className="p-2 w-full border-t border-border">
      <h2 className="text-lg text-foreground mb-2">Results</h2>
      <ul className="flex flex-col gap-2">
        {keys.map((key) => (
          <RpcCallResultBox key={key} subscription={key} />
        ))}
      </ul>
    </div>
  )
}

const RpcCallResultBox: FC<{ subscription: string }> = ({ subscription }) => {
  const rpcCallResult = useStateObservable(rpcCallResult$(subscription))
  if (!rpcCallResult) return null

  return (
    <li className="border rounded bg-card text-card-foreground p-2">
      <div className="flex justify-between items-center pb-1 overflow-hidden">
        <h3 className="overflow-hidden text-ellipsis whitespace-nowrap font-mono text-sm">
          {rpcCallResult.method}({rpcCallResult.payload})
        </h3>
        <div className="flex items-center shrink-0 gap-2">
          <button onClick={() => removeRpcCallResult(subscription)}>
            <Trash2
              size={20}
              className="text-destructive cursor-pointer hover:text-polkadot-500"
            />
          </button>
        </div>
      </div>
      <PathsRoot.Provider value={subscription}>
        <ResultDisplay rpcCallResult={rpcCallResult} />
      </PathsRoot.Provider>
    </li>
  )
}

const ResultDisplay: FC<{
  rpcCallResult: RpcCallResult
}> = ({ rpcCallResult }) => {
  if ("error" in rpcCallResult) {
    return (
      <div className="text-sm">
        <div>The call crashed</div>
        <div>Message: {rpcCallResult.error.message ?? "N/A"}</div>
      </div>
    )
  }

  if (!("result" in rpcCallResult)) {
    return <div className="text-sm text-foreground/50">Loading…</div>
  }

  return (
    <div className="max-h-[60svh] overflow-auto">
      <JsonDisplay src={rpcCallResult.result} />
    </div>
  )
}
