import { ActionButton } from "@/components/ActionButton"
import { LoadingMetadata } from "@/components/Loading"
import { SearchableSelect } from "@/components/Select"
import { withSubscribe } from "@/components/withSuspense"
import { chainClient$ } from "@/state/chains/chain.state"
import { state, useStateObservable } from "@react-rxjs/core"
import { lazy, Suspense, useRef, useState } from "react"
import { firstValueFrom, map, switchMap } from "rxjs"
import { RpcCallResults } from "./RpcCallResults"
import { addRpcCallQuery } from "./rpcCalls.state"
import { useTheme } from "@/ThemeProvider"

const Editor = lazy(() => import("@monaco-editor/react"))

const chainRpcMethods$ = state(
  chainClient$.pipe(
    switchMap((chain) =>
      chain.client._request<{ methods: string[] }>("rpc_methods", []),
    ),
    map((r) => r.methods),
  ),
)

const SCHEMA_URL = window.location.origin
export const RpcCalls = withSubscribe(
  () => {
    const methods = useStateObservable(chainRpcMethods$)
    const setSchema = useRef<((method: string | null) => void) | null>(null)
    const [method, _setMethod] = useState<string | null>(null)
    const [params, setParams] = useState<string>("[\n  \n]")
    const theme = useTheme()

    const setMethod = (method: string | null) => {
      _setMethod(method)
      setSchema.current?.(method)
    }

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
        <div className="w-full">
          JSON Payload
          <Suspense
            fallback={<div className="border rounded p-1 h-80 w-full" />}
          >
            <Editor
              className="border rounded p-1 h-80"
              language="json"
              onMount={(editor, monaco) => {
                const model = editor.getModel()
                if (!model) return

                setSchema.current = (method) => {
                  monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
                    validate: true,
                    schemas: method
                      ? [
                          {
                            uri: `${SCHEMA_URL}/rpc_schemas/${method}.json`,
                            fileMatch: [model.uri.toString()],
                          },
                        ]
                      : [],
                    enableSchemaRequest: true,
                    schemaRequest: "ignore",
                  })
                  monaco.languages.json.jsonDefaults.setModeConfiguration(
                    method
                      ? { completionItems: true, diagnostics: true }
                      : {
                          completionItems: false,
                          diagnostics: true,
                        },
                  )
                }
                setSchema.current(method)
              }}
              value={params}
              loading={<div className="border rounded p-1 h-80 w-full" />}
              onChange={(v) => setParams(v ?? "[]")}
              options={{
                minimap: {
                  enabled: false,
                },
                lineNumbers: "off",
              }}
              theme={theme === "dark" ? "vs-dark" : "light"}
            />
          </Suspense>
        </div>
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
