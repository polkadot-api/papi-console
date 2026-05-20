import { pushWorkspaceEntry, WorkspaceEntryData } from "@/components/Workspace"
import { runtimeCtxAt$, unsafeApi$ } from "@/state/chains/chain.state"
import { RuntimeContext } from "@polkadot-api/observable-client"
import { UnifiedMetadata } from "@polkadot-api/substrate-bindings"
import { state } from "@react-rxjs/core"
import { createSignal } from "@react-rxjs/utils"
import { SquareFunction } from "lucide-react"
import { Binary, HexString, ResultPayload } from "polkadot-api"
import { catchError, combineLatest, firstValueFrom, from, map, of } from "rxjs"
import { stringifyArg } from "../Storage/storage.state"
import {
  ViewFnWorkspaceContext,
  ViewFnWorkspaceEntry,
} from "./ViewFnWorkspaceEntry"

type Pallet = UnifiedMetadata["pallets"][number]
export type ViewFnEntry = Pallet["viewFns"][number] & {
  pallet: string
}

export const [entryChange$, setSelectedFn] = createSignal<ViewFnEntry | null>()
export const selectedEntry$ = state(entryChange$, null)

type ViewFnCall = {
  blockHash: HexString
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
    call.blockHash,
    call.pallet,
    call.name,
    Binary.toHex(codec.enc(call.args)),
  ].join(":")
}

export const idToViewFnCall = async (id: string): Promise<ViewFnCall> => {
  const [blockHash, pallet, name, encodedArgs] = id.split(":")
  const ctx = await firstValueFrom(runtimeCtxAt$(blockHash))
  const codec = ctx.dynamicBuilder.buildViewFn(pallet, name).args
  const args = codec.dec(encodedArgs)

  return { blockHash, pallet, name, args }
}

export const viewFnCallToWorkspaceEntry = async (
  call: ViewFnCall,
): Promise<WorkspaceEntryData<ViewFnWorkspaceContext>> => {
  const [unsafeApi, ctx] = await firstValueFrom(
    combineLatest([unsafeApi$, runtimeCtxAt$(call.blockHash)]),
  )

  const result$ = state<ViewFnResult | null>(
    from(
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
    ),
    null,
  )
  const context: ViewFnWorkspaceContext = {
    pallet: call.pallet,
    name: call.name,
    result$,
  }
  const id = viewFnCallToId(ctx, call)

  return {
    id,
    source: "View Functions",
    title: [call.pallet, call.name].join("."),
    subtitle: `${call.args.map(stringifyArg)}`,
    icon: SquareFunction,
    link: `viewFns/${id}`,
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
