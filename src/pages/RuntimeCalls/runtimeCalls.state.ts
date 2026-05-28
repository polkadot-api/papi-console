import { createMetadataEntryState } from "@/components/MetadataEntryInput"
import { pushWorkspaceEntry, WorkspaceEntryData } from "@/components/Workspace"
import { getHashParams } from "@/hashParams"
import { runtimeCtxAt$, unsafeApi$ } from "@/state/chains/chain.state"
import { RuntimeContext } from "@polkadot-api/observable-client"
import { state } from "@react-rxjs/core"
import { ServerCog } from "lucide-react"
import { Binary, Codec, HexString, ResultPayload } from "polkadot-api"
import {
  catchError,
  combineLatest,
  firstValueFrom,
  from,
  map,
  of,
  startWith,
} from "rxjs"
import { stringifyArg } from "../Storage/storage.state"
import {
  RuntimeCallWorkspaceContext,
  RuntimeCallWorkspaceEntry,
} from "./RuntimeCallWorkspaceEntry"

export type RuntimeCallMetadataMethod = {
  api: string
  name: string
  inputs: {
    name: string
    type: number
  }[]
  output: number
  docs: string[]
}

export const runtimeCallEntryState = createMetadataEntryState(
  (ctx) =>
    Object.fromEntries(
      ctx.lookup.metadata.apis.map((api) => [
        api.name,
        api.methods.map((method) => method.name),
      ]),
    ),
  () => {
    const params = getHashParams()
    const group = params.get("api") ?? "Core"
    const item = params.get("method") ?? "Version"
    return { item, group }
  },
  (ctx, entry): RuntimeCallMetadataMethod => {
    const api = ctx.lookup.metadata.apis.find(
      (api) => api.name === entry.group,
    )!
    const method = api.methods.find((i) => i.name === entry.item)!
    return {
      api: api.name,
      ...method,
    }
  },
)

type RuntimeCallQuery = {
  blockHash: HexString
  latestBlock: boolean
  api: string
  method: string
  args: unknown[]
}

const runtimeQueryToId = (
  ctx: Pick<RuntimeContext, "dynamicBuilder" | "lookup">,
  query: RuntimeCallQuery,
) => {
  const codec = ctx.dynamicBuilder.buildRuntimeCall(query.api, query.method)

  return [
    (query.latestBlock ? "latest_" : "") + query.blockHash,
    query.api,
    query.method,
    Binary.toHex(codec.args.enc(query.args)),
  ].join(":")
}
export const idToRuntimeQuery = async (
  id: string,
): Promise<
  RuntimeCallQuery & {
    codec: Codec<any> & {
      inner: Codec<any>[]
    }
  }
> => {
  const [blockHashStr, api, method, args] = id.split(":")
  const latestBlock = blockHashStr.startsWith("latest_")
  const blockHash = blockHashStr.replace("latest_", "")

  const ctx = await firstValueFrom(runtimeCtxAt$(blockHash))
  const codec = ctx.dynamicBuilder.buildRuntimeCall(api, method).args

  return {
    latestBlock,
    blockHash,
    api,
    method,
    args: codec.dec(args),
    codec,
  }
}
export const runtimeCallToWorkspaceEntry = async (
  query: RuntimeCallQuery,
): Promise<WorkspaceEntryData<RuntimeCallWorkspaceContext>> => {
  const [unsafeApi, ctx] = await firstValueFrom(
    combineLatest([unsafeApi$, runtimeCtxAt$(query.blockHash)]),
  )

  const query$ = from(
    unsafeApi.apis[query.api][query.method](...query.args, {
      at: query.blockHash,
    }),
  ).pipe(
    map((result) => ({
      success: true,
      value: result,
    })),
    catchError((ex) => {
      console.error(ex)
      return of({
        success: false,
        value: ex,
      })
    }),
  )

  const result$ = state(query$, null)
  const context: RuntimeCallWorkspaceContext = {
    api: query.api,
    method: query.method,
    blockHash: query.blockHash,
    result$,
  }
  const id = runtimeQueryToId(ctx, query)

  return {
    id,
    source: "Runtime Calls",
    title: [query.api, query.method].join("."),
    subtitle: `${query.args.map(stringifyArg)}`,
    link: `/runtimeCalls/${id}`,
    status: query$.pipe(
      map((v) => (v.success ? ("done" as const) : ("error" as const))),
      startWith("pending" as const),
    ),
    icon: ServerCog,
    context,
    content: RuntimeCallWorkspaceEntry,
  }
}

export type RuntimeCallResult = ResultPayload<unknown, any>

export const addRuntimeCallQuery = async (query: RuntimeCallQuery) => {
  const data = await runtimeCallToWorkspaceEntry(query)

  pushWorkspaceEntry(data)
  return data.id
}
