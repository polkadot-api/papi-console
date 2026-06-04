import { TAssetInfo, TXcmFeeBase } from "@paraspell/sdk"
import { useStateObservable } from "@react-rxjs/core"
import {
  ArrowRight,
  CheckCircle2,
  CircleDot,
  Coins,
  Loader2,
  Route,
} from "lucide-react"
import { FC, ReactNode } from "react"
import { switchMap } from "rxjs"
import { paraspellBuilder$ } from "./Setup"

export const routeInfo$ = paraspellBuilder$.pipeState(
  switchMap((builder) => (builder ? builder.getTransferInfo() : [null])),
)

export const RoutePreview = () => {
  const builder = useStateObservable(paraspellBuilder$)
  const routeInfo = useStateObservable(routeInfo$)

  if (!builder)
    return (
      <Panel title="Route preview">
        <EmptyState
          icon={<Route className="h-4 w-4" />}
          title="Complete transfer setup"
          description="Select an asset, destination, amount, and recipient to preview the route."
        />
      </Panel>
    )

  if (!routeInfo)
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
    {
      label: routeInfo.chain.origin,
      detail: routeInfo.chain.ecosystem,
    },
    ...routeInfo.hops.map((hop) => ({
      label: hop.chain,
      detail: "Hop",
    })),
    {
      label: routeInfo.chain.destination,
      detail: "Destination",
    },
  ]

  return (
    <Panel title="Route preview">
      <ol className="space-y-2 @lg:flex @lg:items-stretch @lg:space-y-0">
        {routeNodes.map((node, i) => (
          <li
            key={`${node.label}-${i}`}
            className="flex min-w-0 items-center gap-2 @lg:flex-1"
          >
            <div className="flex min-w-0 flex-1 items-center gap-3 rounded-md border border-border bg-background px-3 py-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-foreground/5 text-muted-foreground">
                {i === 0 ? (
                  <CircleDot className="h-4 w-4" />
                ) : i === routeNodes.length - 1 ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Route className="h-4 w-4" />
                )}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{node.label}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {node.detail}
                </div>
              </div>
            </div>
            {i < routeNodes.length - 1 ? (
              <ArrowRight className="hidden h-4 w-4 shrink-0 text-muted-foreground @lg:block" />
            ) : null}
          </li>
        ))}
      </ol>

      <div className="grid gap-3 @2xl:grid-cols-2">
        <DetailGroup title="Origin">
          <DetailRow label="Chain" value={routeInfo.chain.origin} />
          <DetailRow
            label="XCM fee"
            value={<XcmFee fee={routeInfo.origin.xcmFee} />}
          />
          <DetailRow
            label="Balance"
            value={formatValue(routeInfo.origin.xcmFee.balance)}
          />
          <DetailRow
            label="Balance after"
            value={formatValue(routeInfo.origin.xcmFee.balanceAfter)}
          />
        </DetailGroup>

        <DetailGroup title="Destination">
          <DetailRow label="Chain" value={routeInfo.chain.destination} />
          <DetailRow
            label="XCM fee"
            value={<XcmFee fee={routeInfo.destination.xcmFee} />}
          />
          <DetailRow
            label="Received"
            value={formatValue(
              routeInfo.destination.receivedCurrency.receivedAmount,
            )}
          />
          <DetailRow
            label="Balance after"
            value={formatValue(
              routeInfo.destination.receivedCurrency.balanceAfter,
            )}
          />
        </DetailGroup>
      </div>

      {routeInfo.hops.length ? (
        <DetailGroup title="Hops">
          {routeInfo.hops.map((hop, i) => (
            <div
              key={`${hop.chain}-${i}`}
              className="grid gap-2 rounded-md border border-border/70 bg-background/70 p-2"
            >
              <DetailRow label="Chain" value={hop.chain} />
              <DetailRow
                label="XCM fee"
                value={<XcmFee fee={hop.result.xcmFee} />}
              />
              <DetailRow
                label="Asset"
                value={<AssetDisplay asset={hop.result.asset} />}
              />
            </div>
          ))}
        </DetailGroup>
      ) : null}
    </Panel>
  )
}

const XcmFee: FC<{
  fee: TXcmFeeBase
}> = ({ fee }) => (
  <span className="inline-flex min-w-0 items-center gap-1">
    <span className="truncate font-mono">{formatValue(fee.fee)}</span>
    <AssetDisplay asset={fee.asset} />
  </span>
)

const AssetDisplay: FC<{ asset: TAssetInfo }> = ({ asset }) => (
  <span className="inline-flex min-w-0 items-center gap-1">
    <Coins className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
    <span className="truncate">{asset.symbol}</span>
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
    <span className="min-w-0 break-words text-right">{value}</span>
  </div>
)

const formatValue = (value: unknown): ReactNode => {
  if (value == null || value === "") return "-"
  if (typeof value === "bigint" || typeof value === "number")
    return value.toLocaleString()
  if (typeof value === "string") return value
  return String(value)
}
