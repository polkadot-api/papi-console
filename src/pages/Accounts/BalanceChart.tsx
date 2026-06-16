import { TokenAmount } from "@/components/TokenAmount"
import { FC, ReactNode } from "react"
import { AccountLocks } from "./locks.state"
import { cn } from "@/utils"

export const BalanceChart: FC<{ locks: AccountLocks }> = ({ locks }) => {
  const { total, spendable, reserved, frozen, ed } = locks.balance

  return (
    <section className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="mb-3 flex flex-row gap-2 items-center flex-wrap justify-between">
        <h3 className="text-sm font-semibold uppercase text-muted-foreground">
          Balance
        </h3>
        <div className="text-sm">
          <TokenAmount className="font-medium">{total}</TokenAmount>
        </div>
      </div>

      {total == 0n ? null : (
        <div className="space-y-1">
          <div className="flex flex-wrap items-center justify-between">
            <ChartLegend label="Reserved" value={reserved} tone="reserved" />
            <ChartLegend label="ED" value={ed} tone="ed" />
          </div>
          <div className="flex h-8 overflow-hidden rounded-md border border-border bg-background shadow-inner">
            <ChartLockedArea locked={total - spendable} total={total}>
              <div
                className={cn(
                  "flex h-1/2 min-w-0 overflow-hidden border-b border-border",
                  frozen === 0n ? "h-full border-none" : null,
                )}
              >
                <ChartSegment
                  label="Reserved"
                  value={reserved}
                  total={total - spendable}
                  tone="reserved"
                />
                <ChartSegment
                  label="ED"
                  value={ed}
                  total={total - spendable}
                  tone="ed"
                />
                <div className="min-w-0 flex-1" />
              </div>
              {frozen > 0n ? (
                <div className="flex h-1/2 min-w-0 overflow-hidden">
                  <ChartSegment
                    label="Frozen"
                    value={frozen}
                    total={total - spendable}
                    tone="frozen"
                  />
                  <div className="min-w-0 flex-1" />
                </div>
              ) : null}
            </ChartLockedArea>
            <ChartSpendableSegment value={spendable} total={total} />
          </div>
          <div className="flex flex-wrap items-center justify-between">
            {frozen > 0n ? (
              <ChartLegend label="Frozen" value={frozen} tone="frozen" />
            ) : (
              <div />
            )}
            <ChartLegend label="Spendable" value={spendable} tone="spendable" />
          </div>
        </div>
      )}
    </section>
  )
}

const ChartLegend: FC<{
  label: string
  value: bigint
  tone: BalanceTone
}> = ({ label, value, tone }) =>
  value > 0n ? (
    <div className="flex min-w-0 items-center gap-1">
      <div
        className={`h-3 w-3 shrink-0 rounded-sm border ${chartTone[tone]}`}
      />
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <TokenAmount className="text-xs font-medium">{value}</TokenAmount>
    </div>
  ) : null

const ChartLockedArea: FC<{
  children: ReactNode
  locked: bigint
  total: bigint
}> = ({ children, locked, total }) => {
  if (locked <= 0n || total <= 0n) return null

  return (
    <div
      className="flex h-full min-w-0.5 flex-col"
      style={{ width: `${getPercent(locked, total)}%` }}
    >
      {children}
    </div>
  )
}

const ChartSpendableSegment: FC<{ value: bigint; total: bigint }> = ({
  value,
  total,
}) => {
  if (value <= 0n || total <= 0n) return null

  return (
    <div
      className={`h-full min-w-0.5 border-l ${chartTone.spendable}`}
      style={{ width: `${getPercent(value, total)}%` }}
      title={`Spendable: ${value.toLocaleString()}`}
    />
  )
}

const ChartSegment: FC<{
  label: string
  value: bigint
  total: bigint
  tone: BalanceTone
}> = ({ label, value, total, tone }) => {
  if (value <= 0n || total <= 0n) return null

  return (
    <div
      className={`h-full min-w-0.5 border-r ${chartTone[tone]}`}
      style={{ width: `${getPercent(value, total)}%` }}
      title={`${label}: ${value.toLocaleString()}`}
    />
  )
}

type BalanceTone = "reserved" | "ed" | "spendable" | "frozen"

const chartTone: Record<BalanceTone, string> = {
  reserved: "border-yellow-500/10 bg-yellow-200/80 dark:bg-yellow-400/60",
  ed: "border-rose-500/10 bg-rose-200/80 dark:bg-rose-500/40",
  spendable: "border-green-500/10 bg-green-200/80 dark:bg-green-500/40",
  frozen: "border-sky-500/10 bg-sky-200/80 dark:bg-sky-500/40",
}

const getPercent = (value: bigint, total: bigint) =>
  total <= 0n ? 0 : Number((value * 10_000n) / total) / 100
