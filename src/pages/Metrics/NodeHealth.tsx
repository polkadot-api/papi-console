import { client$ } from "@/state/chains/chain.state"
import { useStateObservable, withDefault } from "@react-rxjs/core"
import { CheckCircle2 } from "lucide-react"
import { FC } from "react"
import { catchError, combineLatest, from, map, of, switchMap } from "rxjs"
import { formatBlockNumber, formatInteger } from "./format"

export const chainStatus$ = client$.pipeState(
  switchMap((client) =>
    combineLatest({
      best: client.bestBlocks$.pipe(
        map(([block]) => ({ hash: block.hash, number: block.number })),
      ),
      finalized: client.finalizedBlock$.pipe(
        map((block) => ({ hash: block.hash, number: block.number })),
      ),
    }),
  ),
  withDefault(null),
)

export const nodeHealth$ = client$.pipeState(
  switchMap((client) =>
    from(
      client._request<{
        peers: number
        isSyncing: boolean
        shouldHavePeers: boolean
      }>("system_health", []),
    ).pipe(catchError(() => of(null))),
  ),
  withDefault(null),
)

export const NodeStatus: FC = () => {
  const chainStatus = useStateObservable(chainStatus$)
  const nodeHealth = useStateObservable(nodeHealth$)

  return (
    <div className="space-y-5 text-sm">
      <div className="space-y-3">
        <StatusRow
          label="Connected peers"
          value={formatInteger(nodeHealth?.peers)}
        />
        <StatusRow
          label="Best block"
          value={formatBlockNumber(chainStatus?.best.number)}
          accent
        />
        <StatusRow
          label="Finalized block"
          value={formatBlockNumber(chainStatus?.finalized.number)}
          accent
        />
      </div>
      <div className="border-t pt-4 space-y-3">
        <HealthRow
          label="Node sync"
          healthy={nodeHealth?.isSyncing === false}
        />
        <HealthRow
          label="Network connectivity"
          healthy={nodeHealth?.peers == null || nodeHealth.peers > 0}
        />
        <HealthRow label="RPC server" healthy />
        <HealthRow label="Metrics stream" healthy={chainStatus?.best != null} />
      </div>
    </div>
  )
}

const StatusRow: FC<{ label: string; value: string; accent?: boolean }> = ({
  label,
  value,
  accent,
}) => (
  <div className="flex items-center justify-between gap-4">
    <span className="text-muted-foreground">{label}</span>
    <span
      className={
        accent
          ? "font-mono text-xs font-semibold text-polkadot-500"
          : "font-medium tabular-nums"
      }
    >
      {value}
    </span>
  </div>
)

const HealthRow: FC<{ label: string; healthy: boolean }> = ({
  label,
  healthy,
}) => (
  <div className="flex items-center justify-between gap-4">
    <span className="inline-flex items-center gap-2 text-muted-foreground">
      <CheckCircle2
        className={
          healthy ? "h-4 w-4 text-green-600" : "h-4 w-4 text-muted-foreground"
        }
      />
      {label}
    </span>
    <span
      className={
        healthy
          ? "font-medium text-green-700 dark:text-green-400"
          : "font-medium text-muted-foreground"
      }
    >
      {healthy ? "Healthy" : "Pending"}
    </span>
  </div>
)
