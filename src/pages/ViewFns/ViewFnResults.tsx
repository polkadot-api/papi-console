import { ButtonGroup } from "@/components/ButtonGroup"
import { useStateObservable } from "@react-rxjs/core"
import { Trash2 } from "lucide-react"
import { FC, useState } from "react"
import { ValueDisplay } from "../Storage/StorageSubscriptions"
import {
  removeViewFnResult,
  ViewFnResult,
  viewFnResult$,
  viewFnResultKeys$,
} from "./viewFns.state"
import { PathsRoot } from "@/codec-components/common/paths.state"

export const ViewFnResults: FC = () => {
  const keys = useStateObservable(viewFnResultKeys$)

  if (!keys.length) return null

  return (
    <div className="p-2 w-full border-t border-border">
      <h2 className="text-lg text-foreground mb-2">Results</h2>
      <ul className="flex flex-col gap-2">
        {keys.map((key) => (
          <ViewFnResultBox key={key} subscription={key} />
        ))}
      </ul>
    </div>
  )
}

const ViewFnResultBox: FC<{ subscription: string }> = ({ subscription }) => {
  const [mode, setMode] = useState<"json" | "decoded">("decoded")
  const viewFnResult = useStateObservable(viewFnResult$(subscription))
  if (!viewFnResult) return null

  return (
    <li className="border rounded bg-card text-card-foreground p-2">
      <div className="flex justify-between items-center pb-1 overflow-hidden">
        <h3 className="overflow-hidden text-ellipsis whitespace-nowrap">
          {viewFnResult.name}
        </h3>
        <div className="flex items-center shrink-0 gap-2">
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
          <button onClick={() => removeViewFnResult(subscription)}>
            <Trash2
              size={20}
              className="text-destructive cursor-pointer hover:text-polkadot-500"
            />
          </button>
        </div>
      </div>
      <PathsRoot.Provider value={subscription}>
        <ResultDisplay viewFnResult={viewFnResult} mode={mode} />
      </PathsRoot.Provider>
    </li>
  )
}

const ResultDisplay: FC<{
  viewFnResult: ViewFnResult
  mode: "json" | "decoded"
}> = ({ viewFnResult, mode }) => {
  if ("error" in viewFnResult) {
    return (
      <div className="text-sm">
        <div>The call crashed</div>
        <div>Message: {viewFnResult.error.message ?? "N/A"}</div>
      </div>
    )
  }

  if (!("result" in viewFnResult)) {
    return <div className="text-sm text-foreground/50">Loading…</div>
  }

  return (
    <div className="max-h-[60svh] overflow-auto">
      <ValueDisplay
        mode={mode}
        type={viewFnResult.type}
        value={viewFnResult.result}
        title={"Result"}
      />
    </div>
  )
}
