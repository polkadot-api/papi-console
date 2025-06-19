import { Chopsticks } from "@/components/Icons"
import { Button } from "@/components/ui/button"
import {
  canProduceBlocks$,
  client$,
  runtimeCtx$,
} from "@/state/chains/chain.state"
import { useStateObservable, withDefault } from "@react-rxjs/core"
import { FC, PropsWithChildren, ReactElement, useEffect, useState } from "react"
import { firstValueFrom, map, switchMap } from "rxjs"
import { twMerge } from "tailwind-merge"
import { BlockTime } from "./BlockTime"
import { EpochRemainingTime } from "./EpochTime"

const finalizedNum$ = client$.pipeState(
  switchMap((chainHead) => chainHead.finalizedBlock$),
  map((v) => v.number),
)
const finalized$ = finalizedNum$.pipeState(map((v) => v.toLocaleString()))
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
  const canJump = useStateObservable(canProduceBlocks$)

  return (
    <div className="flex gap-4 items-center py-2">
      {canJump ? (
        <Jump />
      ) : (
        <SummaryItem title="Block Time" className="bg-card/0 border-none">
          <BlockTime />
        </SummaryItem>
      )}
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
  PropsWithChildren<{ title: string | ReactElement; className?: string }>
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

const Jump = () => {
  const finalized = useStateObservable(finalizedNum$)
  const [value, setValue] = useState(finalized + 1)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setValue((v) => Math.max(v, finalized + 1))
  }, [finalized])

  return (
    <SummaryItem title="" className="bg-card/0 border-none text-center">
      <div className="text-left">
        <span className="text-sm">New Height</span>
        <input
          className="block border rounded p-1"
          type="number"
          value={value}
          onChange={(evt) => setValue(evt.target.valueAsNumber)}
        />
      </div>
      <Button
        size="sm"
        variant="secondary"
        className="py-1 h-auto mt-2"
        onClick={async () => {
          setLoading(true)
          try {
            const client = await firstValueFrom(client$)
            await client._request(
              "dev_newBlock",
              value === finalized + 1
                ? []
                : [
                    {
                      unsafeBlockHeight: value,
                    },
                  ],
            )
          } finally {
            setLoading(false)
          }
        }}
        disabled={loading}
      >
        New Block{" "}
        <Chopsticks className="inline-block align-middle ml-1" size={20} />
      </Button>
    </SummaryItem>
  )
}
