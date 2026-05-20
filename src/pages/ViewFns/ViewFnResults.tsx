import { PathsRoot } from "@/codec-components/common/paths.state"
import { ButtonGroup } from "@/components/ButtonGroup"
import { JsonDisplay } from "@/components/JsonDisplay"
import { workspaceEntryCtxOrAdd$ } from "@/components/Workspace"
import { runtimeCtx$ } from "@/state/chains/chain.state"
import { state, useStateObservable, withDefault } from "@react-rxjs/core"
import { FC, useMemo, useState } from "react"
import { useParams } from "react-router-dom"
import { ValueDisplay } from "../Storage/StorageSubscriptions"
import { ViewFnWorkspaceContext } from "./ViewFnWorkspaceEntry"
import { idToViewFnCall, viewFnCallToWorkspaceEntry } from "./viewFns.state"

export const ViewFnResults: FC = () => {
  const { callId } = useParams()

  if (!callId) return null

  return (
    <div className="p-2 w-full border-t border-border">
      <h2 className="text-lg text-foreground mb-2">Result</h2>
      <ul className="flex flex-col gap-2">
        <ViewFnResultBox id={callId} />
      </ul>
    </div>
  )
}

const viewFnCtx$ = state(
  (id: string) =>
    workspaceEntryCtxOrAdd$(id, async () => {
      const call = await idToViewFnCall(id)
      return viewFnCallToWorkspaceEntry(call)
    }),
  null,
)

const ViewFnResultBox: FC<{ id: string }> = ({ id }) => {
  const context = useStateObservable(viewFnCtx$(id))

  return context ? <ViewFnResultContent id={id} context={context} /> : null
}

const ViewFnResultContent: FC<{
  id: string
  context: ViewFnWorkspaceContext
}> = ({ id, context }) => {
  const [mode, setMode] = useState<"json" | "decoded">("decoded")

  return (
    <li className="border rounded bg-card text-card-foreground p-2">
      <div className="flex justify-between items-center pb-1 overflow-hidden">
        <h3 className="overflow-hidden text-ellipsis whitespace-nowrap">
          {context.pallet}.{context.name}
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
        </div>
      </div>
      <PathsRoot.Provider value={id}>
        <ResultDisplay context={context} mode={mode} />
      </PathsRoot.Provider>
    </li>
  )
}

const defaultedCtx$ = runtimeCtx$.pipeState(withDefault(null))
const ResultDisplay: FC<{
  context: ViewFnWorkspaceContext
  mode: "json" | "decoded"
}> = ({ context, mode }) => {
  const viewFnResult = useStateObservable(context.result$)
  const ctx = useStateObservable(defaultedCtx$)
  const type = useMemo(() => {
    const pallet = ctx?.lookup.metadata.pallets.find(
      (pallet) => pallet.name === context.pallet,
    )
    const fn = pallet?.viewFns.find((fn) => fn.name === context.name)
    return fn?.output ?? null
  }, [context, ctx])

  if (!ctx) return null

  if (!viewFnResult) {
    return <div className="text-sm text-foreground/50">Loading...</div>
  }

  if (!viewFnResult.success) {
    return (
      <div className="text-sm">
        <div>The call crashed</div>
        <div>Message: {viewFnResult.value.message ?? "N/A"}</div>
      </div>
    )
  }

  return (
    <div className="max-h-[60svh] overflow-auto">
      {type == null ? (
        <JsonDisplay src={viewFnResult.value} />
      ) : (
        <ValueDisplay
          mode={mode}
          ctx={ctx}
          type={type}
          value={viewFnResult.value}
          title={"Result"}
        />
      )}
    </div>
  )
}
