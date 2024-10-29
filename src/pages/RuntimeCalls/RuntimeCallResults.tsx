import { ButtonGroup } from "@/components/ButtonGroup"
import { useStateObservable } from "@react-rxjs/core"
import { Trash2 } from "lucide-react"
import { FC, useState } from "react"
import { ValueDisplay } from "../Storage/StorageSubscriptions"
import {
  removeRuntimeCallResult,
  RuntimeCallResult,
  runtimeCallResult$,
  runtimeCallResultKeys$,
} from "./runtimeCalls.state"

export const RuntimeCallResults: FC = () => {
  const keys = useStateObservable(runtimeCallResultKeys$)

  if (!keys.length) return null

  return (
    <div className="p-2 w-full border-t border-slate-400">
      <h2 className="text-lg text-polkadot-200 mb-2">Results</h2>
      <ul className="flex flex-col gap-2">
        {keys.map((key) => (
          <RuntimeCallResultBox key={key} subscription={key} />
        ))}
      </ul>
    </div>
  )
}

const RuntimeCallResultBox: FC<{ subscription: string }> = ({
  subscription,
}) => {
  const [mode, setMode] = useState<"json" | "decoded">("decoded")
  const runtimeCallResult = useStateObservable(runtimeCallResult$(subscription))
  if (!runtimeCallResult) return null

  return (
    <li className="border rounded border-polkadot-200 p-2">
      <div className="flex justify-between items-center pb-1 overflow-hidden">
        <h3 className="text-polkadot-200 overflow-hidden text-ellipsis whitespace-nowrap">
          {runtimeCallResult.name}
        </h3>
        <div className="flex items-center flex-shrink-0 gap-2">
          <ButtonGroup
            value={mode}
            onValueChange={setMode as any}
            items={[
              {
                value: "decoded",
                content: "Decoded",
              },
              {
                value: "json",
                content: "JSON",
              },
            ]}
          />
          <button onClick={() => removeRuntimeCallResult(subscription)}>
            <Trash2
              size={20}
              className="text-polkadot-400 cursor-pointer hover:text-polkadot-500"
            />
          </button>
        </div>
      </div>
      <ResultDisplay runtimeCallResult={runtimeCallResult} mode={mode} />
    </li>
  )
}

const ResultDisplay: FC<{
  runtimeCallResult: RuntimeCallResult
  mode: "json" | "decoded"
}> = ({ runtimeCallResult, mode }) => {
  if (!("result" in runtimeCallResult)) {
    return <div className="text-sm text-slate-400">Loading…</div>
  }

  return (
    <div className="max-h-[60svh] overflow-auto">
      <ValueDisplay
        mode={mode}
        type={runtimeCallResult.type}
        value={runtimeCallResult.result}
        title={"Result"}
      />
    </div>
  )
}