import {
  OperationStatus,
  pushWorkspaceEntry,
} from "@/components/HistoryDrawer/historyDrawer.state"
import { JsonDisplay } from "@/components/JsonDisplay"
import { DatabaseSearch } from "lucide-react"
import { FC } from "react"
import {
  catchError,
  distinct,
  endWith,
  filter,
  ignoreElements,
  map,
  mergeAll,
  mergeMap,
  startWith,
  take,
  takeWhile,
  tap,
} from "rxjs"
import {
  StorageSubscription,
  storageSubscription$,
  storageSubscriptionKeys$,
  stringifyArg,
} from "./storage.state"

const StorageWorkspaceEntry: FC<{
  status?: StorageSubscription["status"]
}> = ({ status }) => {
  if (!status) {
    return <p className="text-muted-foreground p-2">Removed</p>
  }

  if (status.type === "loading") {
    return <p className="text-muted-foreground p-2">Loading</p>
  }

  if (status.type === "value") {
    return (
      <div className="text-xs p-2">
        <JsonDisplay src={status.value.payload} />
      </div>
    )
  }

  const result = status.value[status.value.length - 1].result

  return (
    <div className="text-xs p-2">
      <JsonDisplay
        src={result.type === "error" ? result.value : result.value.payload}
      />
    </div>
  )
}

export const storageWorkspaceEntries$ = storageSubscriptionKeys$.pipe(
  mergeAll(),
  distinct(),
  mergeMap((id) =>
    storageSubscription$(id).pipe(
      filter((v) => v != null),
      take(1),
      map((sub) => ({ id, ...sub })),
    ),
  ),
  tap((sub) =>
    pushWorkspaceEntry({
      source: "Storage",
      title: sub.name,
      subtitle: sub.args?.map(stringifyArg).join(" "),
      icon: DatabaseSearch,
      progress: storageSubscription$(sub.id).pipe(
        takeWhile((v) => !!v && !v.completed),
        catchError(() => [null]),
        ignoreElements(),
        startWith("live" as OperationStatus),
        endWith("done" as OperationStatus),
      ),
      contentData: storageSubscription$(sub.id).pipe(map((v) => v?.status)),
      content: ({ data }) => <StorageWorkspaceEntry status={data} />,
    }),
  ),
)
