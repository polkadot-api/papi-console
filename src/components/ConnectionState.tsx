import { client$, selectedChain$ } from "@/state/chains/chain.state"
import {
  liftSuspense,
  SUSPENSE,
  useStateObservable,
  withDefault,
} from "@react-rxjs/core"
import { startWith, switchMap, take, timer } from "rxjs"

const firstBlockTime$ = client$.pipeState(
  switchMap((client) => client.finalizedBlock$.pipe(take(1))),
  liftSuspense(),
  startWith(SUSPENSE),
  switchMap((v) => (v === SUSPENSE ? timer(0, 1000) : [null])),
  withDefault(null),
)

export const ConnectionState = () => {
  const chain = useStateObservable(selectedChain$)
  const firstBlockTime = useStateObservable(firstBlockTime$)

  const chainName = getChainName(chain)

  return (
    <div
      className={`fixed left-4 bottom-4 z-50 flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium shadow-md backdrop-blur transition-opacity duration-[250ms] ${
        firstBlockTime != null ? "opacity-100" : "opacity-0 pointer-events-none"
      } ${
        firstBlockTime == null || firstBlockTime < 10
          ? "border-border bg-popover text-popover-foreground"
          : firstBlockTime < 30
            ? "border-amber-500/40 bg-amber-500/10 text-amber-800"
            : "border-red-500/40 bg-red-500/10 text-red-800"
      }`}
      role="status"
      aria-live="polite"
      aria-hidden={!firstBlockTime}
    >
      <div className="h-3 w-3 rounded-full border-2 animate-spin border-popover-foreground/30 border-t-popover-foreground/80" />
      <span>Connecting to {chainName}…</span>
    </div>
  )
}

const getChainName = (selectedChain: {
  network: { id: string; display: string }
  endpoint: string
}) => {
  if (selectedChain.network.id === "custom") {
    try {
      const url = new URL(selectedChain.endpoint)
      if (["127.0.0.1", "localhost"].includes(url.hostname)) {
        return "Localhost"
      }

      return url.hostname
    } catch {
      return selectedChain.endpoint
    }
  }
  return selectedChain.network.display
}
