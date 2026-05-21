import { JsonDisplay } from "@/components/JsonDisplay"
import { workspaceEntry$ } from "@/components/Workspace"
import { state, useStateObservable } from "@react-rxjs/core"
import { FC } from "react"
import { catchError, of, switchMap } from "rxjs"

const workspaceValue$ = state(
  (id: string) =>
    workspaceEntry$(id).pipe(
      switchMap((v) => v.data.context!.promise),
      catchError((ex) =>
        of({
          type: "error",
          value: ex,
        }),
      ),
    ),
  null,
)

export const RpcCallWorkspaceEntry: FC<{
  id: string
}> = ({ id }) => {
  const value = useStateObservable(workspaceValue$(id))

  if (!id) return null

  return (
    <div className="p-3 text-sm">
      <JsonDisplay src={value} collapsed={1} />
    </div>
  )
}
