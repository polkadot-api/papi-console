import { createMetadataEntryState } from "@/components/MetadataEntryInput"
import { pushWorkspaceEntry, WorkspaceEntryData } from "@/components/Workspace"
import { getHashParams } from "@/hashParams"
import { genericUnsafeApi$, runtimeCtxAt$ } from "@/state/chains/chain.state"
import { RuntimeContext } from "@polkadot-api/observable-client"
import { shareLatest, state } from "@react-rxjs/core"
import { SquareFunction } from "lucide-react"
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
  ViewFnWorkspaceContext,
  ViewFnWorkspaceEntry,
} from "./ViewFnWorkspaceEntry"

export type ViewFnEntry = {
  pallet: string
  name: string
  inputs: {
    name: string
    type: number
  }[]
  output: number
  docs: string[]
}

export const viewFnEntryState = createMetadataEntryState(
  (ctx) =>
    Object.fromEntries(
      ctx.lookup.metadata.pallets
        .filter((pallet) => pallet.viewFns.length)
        .map((pallet) => [
          pallet.name,
          pallet.viewFns.map((viewFn) => viewFn.name),
        ]),
    ),
  (entries) => {
    const params = getHashParams()
    const group = params.get("pallet") ?? Object.keys(entries)[0] ?? null
    const item =
      params.get("fn") ??
      params.get("function") ??
      (group ? entries[group]?.[0] : null) ??
      null
    return { item, group }
  },
  (ctx, entry): ViewFnEntry => {
    const pallet = ctx.lookup.metadata.pallets.find(
      (pallet) => pallet.name === entry.group,
    )!
    const viewFn = pallet.viewFns.find((i) => i.name === entry.item)!
    return {
      pallet: pallet.name,
      ...viewFn,
    }
  },
)

type ViewFnCall = {
  blockHash: HexString
  latestBlock: boolean
  pallet: string
  name: string
  args: unknown[]
}

const viewFnCallToId = (
  ctx: Pick<RuntimeContext, "dynamicBuilder" | "lookup">,
  call: ViewFnCall,
) => {
  const codec = ctx.dynamicBuilder.buildViewFn(call.pallet, call.name).args

  return [
    (call.latestBlock ? "latest_" : "") + call.blockHash,
    call.pallet,
    call.name,
    Binary.toHex(codec.enc(call.args)),
  ].join(":")
}

export const idToViewFnCall = async (
  id: string,
): Promise<
  ViewFnCall & {
    codec: Codec<any> & {
      inner: Codec<any>[]
    }
  }
> => {
  const [blockHashStr, pallet, name, encodedArgs] = id.split(":")
  const latestBlock = blockHashStr.startsWith("latest_")
  const blockHash = blockHashStr.replace("latest_", "")

  const ctx = await firstValueFrom(runtimeCtxAt$(blockHash))
  const codec = ctx.dynamicBuilder.buildViewFn(pallet, name).args
  const args = codec.dec(encodedArgs)

  return { latestBlock, blockHash, pallet, name, args, codec }
}

export const viewFnCallToWorkspaceEntry = async (
  call: ViewFnCall,
): Promise<WorkspaceEntryData<ViewFnWorkspaceContext>> => {
  const [unsafeApi, ctx] = await firstValueFrom(
    combineLatest([genericUnsafeApi$, runtimeCtxAt$(call.blockHash)]),
  )

  const query$ = from(
    unsafeApi.view[call.pallet][call.name](...call.args, {
      at: call.blockHash,
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
    shareLatest(),
  )

  const result$ = state<ViewFnResult | null>(query$, null)
  const context: ViewFnWorkspaceContext = {
    pallet: call.pallet,
    name: call.name,
    blockHash: call.blockHash,
    result$,
  }
  const id = viewFnCallToId(ctx, call)

  return {
    id,
    source: "View Functions",
    title: [call.pallet, call.name].join("."),
    subtitle: `${call.args.map(stringifyArg)}`,
    icon: SquareFunction,
    link: `/viewFns/${id}`,
    status: query$.pipe(
      map((v) => (v.success ? ("done" as const) : ("error" as const))),
      startWith("pending" as const),
    ),
    context,
    content: ViewFnWorkspaceEntry,
  }
}

export type ViewFnResult = ResultPayload<unknown, any>

export const addViewFnCall = async (call: ViewFnCall) => {
  const data = await viewFnCallToWorkspaceEntry(call)

  pushWorkspaceEntry(data)
  return data.id
}
