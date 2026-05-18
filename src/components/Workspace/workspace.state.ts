import { createLocalStorageState, createState } from "@/lib/externalState"
import { selectedChainChanged$ } from "@/state/chains/chain.state"
import { shareLatest, state } from "@react-rxjs/core"
import {
  combineKeys,
  createKeyedSignal,
  createSignal,
  partitionByKey,
  toKeySet,
} from "@react-rxjs/utils"
import { ComponentType } from "react"
import {
  catchError,
  combineLatest,
  defer,
  from,
  map,
  merge,
  Observable,
  ObservableInput,
  of,
  scan,
  startWith,
  switchMap,
  take,
  takeUntil,
  tap,
} from "rxjs"

export const [workspaceDocked$, setWorkspaceDocked] = createLocalStorageState(
  "workspace-docked",
  false,
)
export const [workspaceOpen$, setWorkspaceOpen] = createState(false)

export type WorkspaceFilter = "pinned" | "transactions" | "queries"
export const [workspaceFilter$, setWorkspaceFilter] =
  createState<WorkspaceFilter | null>(null)

export type OperationStatus = "live" | "pending" | "error" | "done"

export type WorkspaceEntryData<T = any> = {
  id: string
  // Explorer, Storage, Extrinsics, etc.
  source: string
  // The main action - usually Pallet.name
  title: string
  // A small description with additional info. E.g. block number, signer, etc.
  subtitle?: string
  link?: string
  icon: ComponentType<{ size?: number; className?: string }>
  content: ComponentType<{ id: string; context: T }>
  status?: Observable<OperationStatus>
  context?: T
}

export type WorkspaceEntry<T = any> = {
  timestamp: number
  pinned: boolean
  data: WorkspaceEntryData<T>
  status?: OperationStatus
}

const [newWorkspaceEntry$, _pushWorkspaceEntry] =
  createSignal<WorkspaceEntryData>()
export const pushWorkspaceEntry: <T>(payload: WorkspaceEntryData<T>) => void =
  _pushWorkspaceEntry
export const [removeWorkspaceEntry$, removeWorkspaceEntry] =
  createKeyedSignal<string>()
export const [pinWorkspaceEntry$, pinWorkspaceEntry] =
  createKeyedSignal<string>()

export const [workspaceEntry$, workspaceEntryKeys$] = partitionByKey(
  newWorkspaceEntry$,
  (data) => data.id,
  (group$, id) =>
    group$.pipe(
      switchMap((data) => {
        const timestamp = Date.now()
        return combineLatest({
          pinned: pinWorkspaceEntry$(id).pipe(
            scan((acc) => !acc, false),
            startWith(false),
          ),
          status:
            data.status?.pipe(
              startWith(undefined),
              catchError((ex): ObservableInput<OperationStatus> => {
                console.error(ex)
                return ["error"]
              }),
            ) ?? of(undefined),
        }).pipe(
          map(
            ({ pinned, status }): WorkspaceEntry => ({
              data,
              pinned,
              timestamp,
              status,
            }),
          ),
        )
      }),
      takeUntil(merge(removeWorkspaceEntry$(id), selectedChainChanged$)),
    ),
)

export const workspaceEntries$ = state(
  combineLatest([
    combineKeys(workspaceEntryKeys$, workspaceEntry$),
    workspaceFilter$,
  ]).pipe(
    map(([entryMap, workspaceFilter]) => {
      let entries = [...entryMap.values()]
      if (workspaceFilter) {
        entries = entries.filter((entry) => {
          switch (workspaceFilter) {
            case "pinned":
              return entry.pinned
            case "queries":
              return entry.data.source !== "Extrinsics"
            case "transactions":
              return entry.data.source === "Extrinsics"
          }
        })
      }
      entries.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1
        if (!a.pinned && b.pinned) return 1
        return b.timestamp - a.timestamp
      })
      return entries
    }),
  ),
  [],
)

const keySet$ = workspaceEntryKeys$.pipe(toKeySet(), shareLatest())

export const workspaceEntryCtxOr$ = <T>(id: string, fallback$: Observable<T>) =>
  keySet$.pipe(
    take(1),
    switchMap((keys) =>
      keys.has(id)
        ? workspaceEntry$(id).pipe(
            take(1),
            map((v) => v.data.context as T),
          )
        : fallback$,
    ),
    shareLatest(),
  )

export const workspaceEntryCtxOrAdd$ = <T>(
  id: string,
  fallback: () => Promise<WorkspaceEntryData<T>>,
) =>
  workspaceEntryCtxOr$(
    id,
    defer(() => {
      const data = fallback()
      return from(data).pipe(
        tap((entryData) => {
          if (entryData.id !== id) {
            console.warn(
              "New id doesn't match existing id. This could create multiple instances in the long run",
              {
                id,
                entryData,
              },
            )
          }
          pushWorkspaceEntry(entryData)
        }),
        map((data) => data.context!),
      )
    }),
  )
