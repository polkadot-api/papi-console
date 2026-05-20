import { pushWorkspaceEntry } from "@/components/Workspace"
import { state } from "@react-rxjs/core"
import {
  createKeyedSignal,
  createSignal,
  partitionByKey,
  toKeySet,
} from "@react-rxjs/utils"
import { Cable } from "lucide-react"
import {
  catchError,
  from,
  map,
  Observable,
  of,
  startWith,
  switchMap,
  takeUntil,
} from "rxjs"
import { v4 as uuid, v4 } from "uuid"
import { RpcCallWorkspaceEntry } from "./RpcCallWorkspaceEntry"

export type RpcCallMetadataMethod = {
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
  createSignal<RpcCallMetadataMethod | null>()
export const selectedEntry$ = state(entryChange$, null)

const [newRpcCallQuery$, _addRpcCallQuery] = createSignal<{
  method: string
  payload: string
  promise: Promise<unknown>
}>()
export const [removeRpcCallResult$, removeRpcCallResult] =
  createKeyedSignal<string>()

export const addRpcCallQuery = (value: {
  method: string
  payload: string
  promise: Promise<unknown>
}) => {
  _addRpcCallQuery(value)
  pushWorkspaceEntry({
    id: v4(),
    icon: Cable,
    content: RpcCallWorkspaceEntry,
    source: "RPC Calls",
    title: value.method,
    subtitle: value.payload === "[]" ? undefined : value.payload,
    status: from(value.promise).pipe(
      map(() => "done" as const),
      startWith("pending" as const),
    ),
    context: {
      promise: value.promise,
    },
  })
}

export type RpcCallResult = {
  method: string
  payload: string
} & ({ result: unknown } | { error?: any })
const [getRpcCallSubscription$, rpcCallKeyChange$] = partitionByKey(
  newRpcCallQuery$,
  () => uuid(),
  (src$, id) =>
    src$.pipe(
      switchMap(
        ({ promise, ...props }): Observable<RpcCallResult> =>
          from(promise).pipe(
            map((result) => ({
              ...props,
              result,
            })),
            catchError((ex) => {
              console.error(ex)
              return of({
                ...props,
                error: ex,
              })
            }),
            startWith(props),
          ),
      ),
      takeUntil(removeRpcCallResult$(id)),
    ),
)

export const rpcCallResultKeys$ = state(
  rpcCallKeyChange$.pipe(
    toKeySet(),
    map((keys) => [...keys].reverse()),
  ),
  [],
)

export const rpcCallResult$ = state(
  (key: string): Observable<RpcCallResult> => getRpcCallSubscription$(key),
  null,
)
