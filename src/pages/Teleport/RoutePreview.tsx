import { TXcmFeeBase } from "@paraspell/sdk"
import { formatToken } from "@polkadot-api/react-components"
import { useStateObservable } from "@react-rxjs/core"
import {
  ArrowRight,
  CheckCircle2,
  CircleDot,
  Loader2,
  Route,
} from "lucide-react"
import { FC, ReactNode } from "react"
import { from, startWith, switchMap } from "rxjs"
import { paraspellBuilder$ } from "./Setup"

export const routeInfo$ = paraspellBuilder$.pipeState(
  switchMap((builder) =>
    builder
      ? from(
          builder.getTransferInfo().catch((ex) => {
            console.error(ex)
            return null
          }),
        ).pipe(startWith("loading" as const))
      : [null],
  ),
)

export const RoutePreview = () => {
  const routeInfo = useStateObservable(routeInfo$)
  if (!routeInfo)
    return (
      <Panel title="Route preview">
        <EmptyState
          icon={<Route className="h-4 w-4" />}
          title="Complete transfer setup"
          description="Select an asset, destination, amount, and recipient to preview the route."
        />
      </Panel>
    )

  if (routeInfo === "loading")
    return (
      <Panel title="Route preview">
        <EmptyState
          icon={<Loader2 className="h-4 w-4 animate-spin" />}
          title="Loading route"
          description="Fetching route and fee information."
        />
      </Panel>
    )

  const routeNodes = [
    routeInfo.chain.origin,
    ...routeInfo.hops.map((hop) => hop.chain),
    routeInfo.chain.destination,
  ]

  return (
    <Panel title="Route preview">
      <RoutePath nodes={routeNodes} />

      <DetailGroup title="Origin">
        <DetailRow label="Chain" value={routeInfo.chain.origin} />
        <DetailRow
          label="XCM fee"
          value={<XcmFee fee={routeInfo.origin.xcmFee} />}
        />
      </DetailGroup>

      {routeInfo.hops.map((hop, i) => (
        <DetailGroup title={`Hop ${i + 1}`} key={i}>
          <DetailRow label="Chain" value={hop.chain} />
          <DetailRow
            label="XCM fee"
            value={<XcmFee fee={hop.result.xcmFee} />}
          />
        </DetailGroup>
      ))}

      <DetailGroup title="Destination">
        <DetailRow label="Chain" value={routeInfo.chain.destination} />
        <DetailRow
          label="XCM fee"
          value={<XcmFee fee={routeInfo.destination.xcmFee} />}
        />
        <DetailRow
          label="Received"
          value={
            typeof routeInfo.destination.receivedCurrency.receivedAmount ===
            "bigint"
              ? formatToken(
                  routeInfo.destination.receivedCurrency.receivedAmount,
                  routeInfo.destination.receivedCurrency.asset,
                )
              : "N/A"
          }
        />
      </DetailGroup>
    </Panel>
  )
}

const RoutePath: FC<{
  nodes: Array<string>
}> = ({ nodes }) => {
  if (nodes.length <= 2) return <DirectRoutePath nodes={nodes} />

  return <MultiHopRoutePath nodes={nodes} />
}

const DirectRoutePath: FC<{
  nodes: Array<string>
}> = ({ nodes }) => (
  <ol className="space-y-2 @lg:flex @lg:items-stretch @lg:space-y-0 @lg:gap-1">
    {nodes.map((node, i) => (
      <li key={i} className="flex items-center gap-1 @lg:flex-1">
        <RouteNodeCard label={node} kind={i === 0 ? "origin" : "destination"} />
        {i < nodes.length - 1 ? (
          <ArrowRight className="hidden h-4 w-4 shrink-0 text-muted-foreground @lg:block" />
        ) : null}
      </li>
    ))}
  </ol>
)

const MultiHopRoutePath: FC<{
  nodes: Array<string>
}> = ({ nodes }) => (
  <div className="rounded-md border border-border bg-background/60 p-3 space-y-3">
    <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
      <h3 className="font-medium uppercase tracking-wide">Route</h3>
      <span className="rounded-md border border-border bg-background px-2 py-0.5">
        {nodes.length - 2} hop{nodes.length === 3 ? "" : "s"}
      </span>
    </div>
    <div className="relative">
      {/* Timeline that goes through the icons */}
      <div
        className="absolute bottom-8 left-4 top-8 w-px bg-border"
        aria-hidden
      />
      <ol className="space-y-3">
        {nodes.map((node, i) => {
          const isFirst = i === 0
          const isLast = i === nodes.length - 1
          const kind = isFirst ? "origin" : isLast ? "destination" : "hop"

          return (
            <li
              key={i}
              className="relative grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-3"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground">
                <RouteNodeIcon kind={kind} />
              </div>
              <div className="flex min-h-16 items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2">
                <div>
                  <div className="truncate text-sm font-medium">{node}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {isFirst ? "Origin" : isLast ? "Destination" : `Hop ${i}`}
                  </div>
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  </div>
)

const RouteNodeCard: FC<{
  label: string
  kind: "origin" | "hop" | "destination"
}> = ({ label, kind }) => (
  <div className="flex flex-1 items-center gap-3 rounded-md border border-border bg-background px-3 py-2">
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-foreground/5 text-muted-foreground">
      <RouteNodeIcon kind={kind} />
    </div>
    <div>
      <div className="truncate text-sm font-medium">{label}</div>
      <div className="truncate text-xs text-muted-foreground capitalize">
        {kind}
      </div>
    </div>
  </div>
)

const RouteNodeIcon: FC<{
  kind: "origin" | "hop" | "destination"
}> = ({ kind }) => {
  if (kind === "origin") return <CircleDot className="h-4 w-4" />
  if (kind === "destination") return <CheckCircle2 className="h-4 w-4" />
  return <Route className="h-4 w-4" />
}

const XcmFee: FC<{
  fee: TXcmFeeBase
}> = ({ fee }) => (
  <span className="truncate tabular-nums">
    {formatToken(fee.fee, fee.asset)}
  </span>
)

const Panel: FC<{
  title: string
  children: ReactNode
}> = ({ title, children }) => (
  <section className="min-w-0 rounded-lg border border-border bg-card text-card-foreground shadow-sm">
    <div className="border-b border-border px-4 py-3">
      <h2 className="text-sm font-semibold">{title}</h2>
    </div>
    <div className="space-y-4 p-4">{children}</div>
  </section>
)

const EmptyState: FC<{
  icon: ReactNode
  title: string
  description: string
}> = ({ icon, title, description }) => (
  <div className="rounded-md border border-dashed border-border bg-background/60 p-4">
    <div className="flex items-start gap-3 text-sm">
      <div className="mt-0.5 text-muted-foreground">{icon}</div>
      <div>
        <div className="font-medium">{title}</div>
        <div className="mt-1 text-muted-foreground">{description}</div>
      </div>
    </div>
  </div>
)

const DetailGroup: FC<{
  title: string
  children: ReactNode
}> = ({ title, children }) => (
  <section className="space-y-2 rounded-md border border-border bg-background/60 p-3">
    <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {title}
    </h3>
    <div className="space-y-2">{children}</div>
  </section>
)

const DetailRow: FC<{
  label: string
  value: ReactNode
}> = ({ label, value }) => (
  <div className="flex items-start justify-between gap-3 text-sm">
    <span className="shrink-0 text-muted-foreground">{label}</span>
    <span className="min-w-0 wrap-break-word text-right">{value}</span>
  </div>
)
