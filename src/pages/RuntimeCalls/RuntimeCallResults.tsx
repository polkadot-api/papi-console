import { PathsRoot } from "@/codec-components/common/paths.state"
import { ButtonGroup } from "@/components/ButtonGroup"
import { JsonDisplay } from "@/components/JsonDisplay"
import { workspaceEntryCtxOrAdd$ } from "@/components/Workspace"
import { runtimeCtx$ } from "@/state/chains/chain.state"
import { shortStr } from "@/utils"
import { state, useStateObservable, withDefault } from "@react-rxjs/core"
import { FC, useEffect, useMemo, useState } from "react"
import { useParams } from "react-router-dom"
import { filter, firstValueFrom } from "rxjs"
import { setBlockHashValue } from "../Storage/BlockPicker"
import { ValueDisplay } from "../Storage/StorageSubscriptions"
import { setInputValue } from "./RuntimeCallQuery"
import { RuntimeCallWorkspaceContext } from "./RuntimeCallWorkspaceEntry"
import {
  idToRuntimeQuery,
  runtimeCallEntryState,
  runtimeCallToWorkspaceEntry,
} from "./runtimeCalls.state"

export const RuntimeCallResults: FC = () => {
  const { callId } = useParams()

  if (!callId) return null

  return (
    <div className="p-2 w-full border-t border-border">
      <h2 className="text-lg text-foreground mb-2">Result</h2>
      <ul className="flex flex-col gap-2">
        <RuntimeCallResultBox id={callId} />
      </ul>
    </div>
  )
}

const runtimeCallCtx$ = state(
  (id: string) =>
    workspaceEntryCtxOrAdd$(id, async () => {
      const query = await idToRuntimeQuery(id)
      return runtimeCallToWorkspaceEntry(query)
    }),
  null,
)

const RuntimeCallResultBox: FC<{ id: string }> = ({ id }) => {
  const context = useStateObservable(runtimeCallCtx$(id))
  useSynchronizeInputs(id)

  return context ? <RuntimeCallResultContent id={id} context={context} /> : null
}

const RuntimeCallResultContent: FC<{
  id: string
  context: RuntimeCallWorkspaceContext
}> = ({ id, context }) => {
  const [mode, setMode] = useState<"json" | "decoded">("decoded")

  return (
    <li className="border rounded bg-card text-card-foreground p-2">
      <div className="flex justify-between items-center pb-1 overflow-hidden">
        <h3 className="overflow-hidden text-ellipsis whitespace-nowrap">
          {context.api}.{context.method}
        </h3>
        <div className="flex items-center shrink-0 gap-2">
          <div className="text-xs text-center">
            <p>Block</p>
            <p>{shortStr(context.blockHash, 6)}</p>
          </div>
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
  context: RuntimeCallWorkspaceContext
  mode: "json" | "decoded"
}> = ({ context, mode }) => {
  const runtimeCallResult = useStateObservable(context.result$)
  const ctx = useStateObservable(defaultedCtx$)
  const type = useMemo(() => {
    const api = ctx?.lookup.metadata.apis.find(
      (api) => api.name === context.api,
    )
    const method = api?.methods.find((method) => method.name === context.method)
    return method?.output ?? null
  }, [context, ctx])

  if (!ctx) return null

  if (!runtimeCallResult) {
    return <div className="text-sm text-foreground/50">Loading…</div>
  }

  if (!runtimeCallResult.success) {
    return (
      <div className="text-sm">
        <div>The call crashed</div>
        <div>Message: {runtimeCallResult.value.message ?? "N/A"}</div>
      </div>
    )
  }

  return (
    <div className="max-h-[60svh] overflow-auto">
      {type == null ? (
        <JsonDisplay src={runtimeCallResult.value} />
      ) : (
        <ValueDisplay
          mode={mode}
          ctx={ctx}
          type={type}
          value={runtimeCallResult.value}
          title={"Result"}
        />
      )}
    </div>
  )
}

const useSynchronizeInputs = (id: string) => {
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const params = await idToRuntimeQuery(id)
      if (cancelled) return
      setBlockHashValue(params.latestBlock ? "Latest" : params.blockHash)
      runtimeCallEntryState.selectEntry({
        group: params.api,
        item: params.method,
      })
      // Let entry settle
      await firstValueFrom(
        runtimeCallEntryState.selectedEntry$.pipe(
          filter(
            (v) => !!v && v.api === params.api && v.name === params.method,
          ),
        ),
      )
      if (cancelled) return
      const encodedArgs = params.args.map((arg, i) =>
        params.codec.inner[i].enc(arg),
      )
      encodedArgs.forEach((value, idx) => setInputValue({ idx, value }))
    }
    run()

    return () => {
      cancelled = true
    }
  }, [id])
}
