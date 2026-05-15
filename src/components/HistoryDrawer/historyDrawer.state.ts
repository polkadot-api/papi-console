import { createLocalStorageState, createState } from "@/lib/externalState"
import { state } from "@react-rxjs/core"
import {
  combineKeys,
  createKeyedSignal,
  createSignal,
  partitionByKey,
} from "@react-rxjs/utils"
import { ComponentType, ReactNode } from "react"
import {
  catchError,
  combineLatest,
  map,
  Observable,
  ObservableInput,
  of,
  scan,
  startWith,
  switchMap,
  takeUntil,
} from "rxjs"
import { v4 as uuid } from "uuid"

export const [historyDocked$, setHistoryDocked] = createLocalStorageState(
  "history-docked",
  false,
)
export const [historyOpen$, setHistoryOpen] = createState(false)

export type WorkspaceFilter = "pinned" | "transactions" | "queries"
export const [workspaceFilter$, setWorkspaceFilter] =
  createState<WorkspaceFilter | null>(null)

export type OperationStatus = "live" | "pending" | "error" | "done"

export type WorkspaceEntryData = {
  // Explorer, Storage, Extrinsics, etc.
  source: string
  // The main action - usually Pallet.name
  title: string
  // A small description with additional info. E.g. block number, signer, etc.
  subtitle?: string
  // This is subscribed by the history drawer entry. Pass a shared/hot or
  // side-effect-free observable so rendering history does not restart work.
  progress?: Observable<OperationStatus>
  link?: string
  icon: ComponentType<{ size?: number; className?: string }>
  content: ReactNode
}

export type WorkspaceEntry = {
  id: string
  timestamp: number
  pinned: boolean
  data: WorkspaceEntryData
  status?: OperationStatus
}

export const [newWorkspaceEntry$, pushWorkspaceEntry] =
  createSignal<WorkspaceEntryData>()
export const [removeWorkspaceEntry$, removeWorkspaceEntry] =
  createKeyedSignal<string>()
export const [pinWorkspaceEntry$, pinWorkspaceEntry] =
  createKeyedSignal<string>()

export const [workspaceEntry$, workspaceEntryKeys$] = partitionByKey(
  newWorkspaceEntry$,
  () => uuid(),
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
            data.progress?.pipe(
              startWith(undefined),
              catchError((ex): ObservableInput<OperationStatus> => {
                console.error(ex)
                return ["error"]
              }),
            ) ?? of(undefined),
        }).pipe(
          map(
            ({ pinned, status }): WorkspaceEntry => ({
              id,
              data,
              pinned,
              timestamp,
              status,
            }),
          ),
        )
      }),
      takeUntil(removeWorkspaceEntry$(id)),
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
