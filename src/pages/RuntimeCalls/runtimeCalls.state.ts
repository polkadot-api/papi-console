import { pushWorkspaceEntry, WorkspaceEntryData } from "@/components/Workspace"
import { runtimeCtxAt$, unsafeApi$ } from "@/state/chains/chain.state"
import { RuntimeContext } from "@polkadot-api/observable-client"
import { state } from "@react-rxjs/core"
import { createSignal } from "@react-rxjs/utils"
import { ServerCog } from "lucide-react"
import { Binary, HexString, ResultPayload } from "polkadot-api"
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

export const [entryChange$, setSelectedMethod] =
  createSignal<RuntimeCallMetadataMethod | null>()
export const selectedEntry$ = state(entryChange$, null)

type RuntimeCallQuery = {
  blockHash: HexString
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
    query.blockHash,
    query.api,
    query.method,
    Binary.toHex(codec.args.enc(query.args)),
  ].join(":")
}
export const idToRuntimeQuery = async (
  id: string,
): Promise<RuntimeCallQuery> => {
  const [blockHash, api, method, args] = id.split(":")
  const ctx = await firstValueFrom(runtimeCtxAt$(blockHash))
  const codec = ctx.dynamicBuilder.buildRuntimeCall(api, method).args

  return {
    blockHash,
    api,
    method,
    args: codec.dec(args),
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
      map(() => "done" as const),
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
