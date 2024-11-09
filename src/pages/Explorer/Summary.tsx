import { chainHead$, runtimeCtx$ } from "@/chain.state"
import { FC, PropsWithChildren, Suspense } from "react"
import { from, map, switchMap } from "rxjs"
import { twMerge } from "tailwind-merge"
import { BlockTime } from "./BlockTime"
import { EpochRemainingTime } from "./EpochTime"
import { useStateObservable, withDefault } from "@react-rxjs/core"
import { tap } from "rxjs"

const finalized$ = chainHead$.pipeState(
  // tap({
  //   next: (v) => console.log("next chainHead$", v),
  //   error: () => console.log("suspense chainHead$"),
  //   subscribe: () => console.log("subscribe chainHead$"),
  //   unsubscribe: () => console.log("unsubscribe chainHead$"),
  // }),
  switchMap((chainHead) => from(chainHead.finalized$)),
  // tap((v) => console.log("finalized", v)),
  map((v) => v.number.toLocaleString()),
)
const best$ = chainHead$.pipeState(
  switchMap((chainHead) => chainHead.best$),
  map((v) => v.number.toLocaleString()),
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
      <Suspense fallback="BlockTime">
        <SummaryItem title="Block Time" className="bg-card/0 border-none">
          <BlockTime />
        </SummaryItem>
      </Suspense>
      <Suspense fallback="Epoch">
        {hasEpoch ? (
          <SummaryItem title="Epoch" className="bg-card/0 border-none">
            <EpochRemainingTime />
          </SummaryItem>
        ) : null}
      </Suspense>
      <div className="flex-1" />
      <Suspense fallback="Finalized">
        <SummaryItem title="Finalized">{finalized$}</SummaryItem>
      </Suspense>
      <Suspense fallback="Best">
        <SummaryItem title="Best">{best$}</SummaryItem>
      </Suspense>
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
