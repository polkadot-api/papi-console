import { BlockContext } from "@/state/block.state"
import { client$ } from "@/state/chains/chain.state"
import { useStateObservable, withDefault } from "@react-rxjs/core"
import { jsonSerialize } from "polkadot-api/utils"
import { FC, useContext } from "react"
import { map, switchMap } from "rxjs"

const finalizedNumber$ = client$.pipeState(
  switchMap((v) => v.bestBlocks$),
  map(([block]) => block.number),
  withDefault(null),
)

export const MortalityAnalyzer: FC<{
  mortality: { type: string; value: number }
}> = ({ mortality }) => {
  const selectedBlock = useContext(BlockContext)
  const finalizedNumber = useStateObservable(finalizedNumber$)
  const selectedBlockNumber = selectedBlock?.number ?? finalizedNumber

  if (mortality.type === "Immortal") {
    return (
      <div className="rounded-lg border border-foreground/10 bg-background/60 px-3 py-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/50">
          Lifetime
        </div>
        <div className="mt-1 text-sm font-medium text-foreground">Immortal</div>
      </div>
    )
  }

  const decoded = decodeMortality(mortality)
  if (decoded === null) {
    return (
      <div className="rounded-lg border border-foreground/10 bg-background/60 px-3 py-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/50">
          Lifetime
        </div>
        <div className="mt-1 font-mono text-sm text-foreground">
          {mortality.type} {mortality.value}
        </div>
      </div>
    )
  }

  const { period, phase } = decoded
  // From fn birth
  const birthBlock = selectedBlockNumber
    ? Math.floor((Math.max(selectedBlockNumber, phase) - phase) / period) *
        period +
      phase
    : null
  const deathBlock = birthBlock == null ? null : birthBlock + period
  const blocksRemaining =
    birthBlock == null || deathBlock == null || selectedBlockNumber == null
      ? null
      : deathBlock - selectedBlockNumber
  const contextProgress =
    birthBlock == null || deathBlock == null || selectedBlockNumber == null
      ? null
      : getTimelineProgress(birthBlock, deathBlock, selectedBlockNumber)

  return (
    <div className="space-y-3 rounded-lg border border-foreground/10 bg-background/60 px-3 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/50">
        Lifetime
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Period" value={period.toLocaleString()} />
        <Metric label="Phase" value={phase.toLocaleString()} />
      </div>

      <div className="rounded-md border border-foreground/10 bg-foreground/5 px-3 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/50">
            Validity Window
          </div>
          <div className="text-xs text-muted-foreground">
            {blocksRemaining == null
              ? null
              : `${blocksRemaining.toLocaleString()} blocks remaining`}
          </div>
        </div>

        <div className="mt-4">
          <div className="relative h-3 rounded-full bg-emerald-500/50">
            {contextProgress != null ? (
              <div
                className="absolute top-1/2 -translate-y-2.5"
                style={{ left: `${contextProgress}%` }}
              >
                <div className="h-5 w-0.5 bg-foreground/60" />
                <div
                  className="text-xs whitespace-nowrap font-semibold text-foreground/60"
                  style={{
                    transform: `translateX(${contextProgress < 10 ? "-1%" : contextProgress > 90 ? "-95%" : "-50%"})`,
                  }}
                >
                  {selectedBlockNumber?.toLocaleString()}
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-5 grid grid-cols-[1fr_1fr] items-start gap-2 text-xs text-muted-foreground">
            <div>
              <div className="font-semibold uppercase tracking-[0.14em] text-foreground/50">
                Start
              </div>
              <div className="mt-1 font-mono text-sm text-foreground">
                {formatOptional(birthBlock)}
              </div>
            </div>
            <div className="text-right">
              <div className="font-semibold uppercase tracking-[0.14em] text-foreground/50">
                End
              </div>
              <div className="mt-1 font-mono text-sm text-foreground">
                {formatOptional(deathBlock)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const Metric: FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-md border border-foreground/10 bg-foreground/5 px-3 py-2">
    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/50">
      {label}
    </div>
    <div className="mt-1 break-all font-mono text-sm text-foreground">
      {value}
    </div>
  </div>
)

const formatOptional = (value: number | null) =>
  value == null ? "N/A" : value.toLocaleString()

const getTimelineProgress = (start: number, end: number, value: number) => {
  if (end <= start) return 0
  const raw = ((value - start) / (end - start)) * 100
  return Math.max(0, Math.min(100, raw))
}

export const InlineMortality: FC<{
  mortality: { type: string; value: number }
}> = ({ mortality }) => {
  if (mortality.type === "Immortal") return "Immortal"

  const decoded = decodeMortality(mortality)
  if (decoded === null) return JSON.stringify(mortality, jsonSerialize)

  return JSON.stringify(decoded) + " " + JSON.stringify(mortality)
}

const decodeMortality = (mortality: { type: string; value: number }) => {
  const parseResult = /^Mortal(\d+)$/.exec(mortality.type)
  if (!parseResult) return null

  const first = BigInt(parseResult[1])
  const second = BigInt(mortality.value)
  // from polkadot-sdk primitives runtime generic era fn decode
  const encoded = first + (second << 8n)
  const period = Number(2n << (encoded % (1n << 4n)))
  const factor = period >> 12 || 1
  const phase = Number(encoded >> 4n) * factor
  return { period, phase }
}
