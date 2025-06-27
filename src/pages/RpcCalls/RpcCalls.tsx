import { ActionButton } from "@/components/ActionButton"
import { LoadingMetadata } from "@/components/Loading"
import { SearchableSelect } from "@/components/Select"
import { Textarea } from "@/components/ui/textarea"
import { withSubscribe } from "@/components/withSuspense"
import { chainClient$ } from "@/state/chains/chain.state"
import { state, useStateObservable } from "@react-rxjs/core"
import { useState } from "react"
import { firstValueFrom, map, switchMap } from "rxjs"
import { RpcCallResults } from "./RpcCallResults"
import { addRpcCallQuery } from "./rpcCalls.state"

const chainRpcMethods$ = state(
  chainClient$.pipe(
    switchMap((chain) =>
      chain.client._request<{ methods: string[] }>("rpc_methods", []),
    ),
    map((r) => r.methods),
  ),
)

export const RpcCalls = withSubscribe(
  () => {
    const methods = useStateObservable(chainRpcMethods$)
    const [method, setMethod] = useState<string | null>(null)
    const [params, setParams] = useState<string>("[\n\n]")

    const submit = async () => {
      const { client } = await firstValueFrom(chainClient$)

      const promise = client._request(method!, JSON.parse(params))
      addRpcCallQuery({
        method: method!,
        payload: JSON.stringify(JSON.parse(params)),
        promise,
      })
    }

    const isReady = method !== "" && isJson(params)

    return (
      <div className="p-4 pb-0 flex flex-col gap-2 items-start">
        <label className="w-full">
          RPC
          <SearchableSelect
            className="w-md max-w-full"
            contentClassName="w-md max-w-full"
            value={method}
            setValue={(v) => setMethod(v)}
            options={methods.map((e) => ({
              text: e,
              value: e,
            }))}
            allowCustomValue
          />
        </label>
        <label className="w-full">
          JSON Payload
          <Textarea
            className="w-full font-mono text-sm"
            value={params}
            onChange={(e) => setParams(e.target.value)}
          />
        </label>
        <ActionButton disabled={!isReady} onClick={submit}>
          Call
        </ActionButton>
        <RpcCallResults />
      </div>
    )
  },
  {
    fallback: <LoadingMetadata />,
  },
)

const isJson = (value: string) => {
  try {
    JSON.parse(value)
    return true
  } catch {
    return false
  }
}
