import { client$, runtimeCtx$ } from "@/state/chains/chain.state"
import { useStateObservable, withDefault } from "@react-rxjs/core"
import { FC, PropsWithChildren } from "react"
import { map, switchMap } from "rxjs"
import { twMerge } from "tailwind-merge"
import { BlockTime } from "./BlockTime"
import { EpochRemainingTime } from "./EpochTime"

const finalized$ = client$.pipeState(
  switchMap((chainHead) => chainHead.finalizedBlock$),
  map((v) => v.number.toLocaleString()),
)
const best$ = client$.pipeState(
  switchMap((chainHead) => chainHead.bestBlocks$),
  map(([v]) => v.number.toLocaleString()),
)

// epoch is only available for relay chains
const hasEpoch$ = runtimeCtx$.pipeState(
  map(({ lookup }) =>
    Boolean(
      lookup.metadata.pallets
        .find(({ name }) => name === "Babe")
        ?.storage?.items.some(({ name }) => name === "EpochStart"),
    ),
  ),
  withDefault(false),
)

export const Summary: FC = () => {
  const hasEpoch = useStateObservable(hasEpoch$)
  return (
    <div className="flex gap-4 items-center py-2">
      <SummaryItem title="Block Time" className="bg-card/0 border-none">
        <BlockTime />
      </SummaryItem>
      {hasEpoch ? (
        <SummaryItem title="Epoch" className="bg-card/0 border-none">
          <EpochRemainingTime />
        </SummaryItem>
      ) : null}
      <div className="flex-1" />
      <SummaryItem title="Finalized">{finalized$}</SummaryItem>
      <SummaryItem title="Best">{best$}</SummaryItem>
    </div>
  )
}

const SummaryItem: FC<
  PropsWithChildren<{ title: string; className?: string }>
> = ({ title, className, children }) => {
  return (
    <div
      className={twMerge(
        "flex flex-col items-center border rounded bg-card text-card-foreground px-3 py-2",
        className,
      )}
    >
      <h3>{title}</h3>
      <div className="tabular-nums text-sm text-card-foreground/80">
        {children}
      </div>
    </div>
  )
}
