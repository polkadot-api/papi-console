import { withSubscribe } from "@/components/withSuspense"
import { useStateObservable } from "@react-rxjs/core"
import { RoutePreview } from "./RoutePreview"
import { origin$, Setup } from "./Setup"
import { Submit } from "./Submit"

export const Teleport = withSubscribe(() => {
  const origin = useStateObservable(origin$)

  if (!origin) {
    // TODO explore custom chains
    return <div>Chain not supported :(</div>
  }

  return (
    <div>
      <Setup />
      <RoutePreview />
      <Submit />
    </div>
  )
})
