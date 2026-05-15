import {
  OperationStatus,
  pushWorkspaceEntry,
} from "@/components/HistoryDrawer/historyDrawer.state"
import { JsonDisplay } from "@/components/JsonDisplay"
import { useStateObservable } from "@react-rxjs/core"
import { DatabaseSearch } from "lucide-react"
import { FC } from "react"
import {
  catchError,
  concatMap,
  distinct,
  endWith,
  filter,
  ignoreElements,
  map,
  mergeAll,
  startWith,
  take,
  takeWhile,
  tap,
} from "rxjs"
import {
  storageSubscription$,
  storageSubscriptionKeys$,
  stringifyArg,
} from "./storage.state"

const StorageWorkspaceEntry: FC<{
  id: string
}> = ({ id }) => {
  const subscription = useStateObservable(storageSubscription$(id))

  if (!subscription) {
    return <p className="text-muted-foreground p-2">Removed</p>
  }

  if (subscription.status.type === "loading") {
    return <p className="text-muted-foreground p-2">Loading</p>
  }

  if (subscription.status.type === "value") {
    return (
      <div className="text-xs p-2">
        <JsonDisplay src={subscription.status.value.payload} />
      </div>
    )
  }

  const result =
    subscription.status.value[subscription.status.value.length - 1].result

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
  concatMap((id) =>
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
      content: <StorageWorkspaceEntry id={sub.id} />,
    }),
  ),
)
