import { client$ } from "@/state/chains/chain.state"
import { polkadot_people } from "@polkadot-api/descriptors"
import { state, useStateObservable } from "@react-rxjs/core"
import { Binary, HexString } from "polkadot-api"
import { FC, ReactNode, useEffect, useState } from "react"
import { combineLatest, firstValueFrom, switchMap } from "rxjs"
import { selectedBlockHex$ } from "./selectedBlock"
import { TokenAmount } from "@/components/TokenAmount"

const maxBlockSize$ = state(
  combineLatest([selectedBlockHex$, client$]).pipe(
    switchMap(([selectedBlock, client]) =>
      Promise.all([
        client.getTypedApi(polkadot_people).constants.System.BlockLength({
          at: selectedBlock,
        }),
        client.getTypedApi(polkadot_people).constants.System.BlockWeights({
          at: selectedBlock,
        }),
      ]).then(
        ([length, weights]) => ({
          length: length.max,
          maxWeight: weights.max_block,
        }),
        () => null,
      ),
    ),
  ),
)

export const AnalyzePriority: FC<{
  txPayment?: { tip?: bigint }
  extrinsic: HexString
}> = ({ txPayment, extrinsic }) => {
  const blockHex = useStateObservable(selectedBlockHex$)
  const maxBlockSize = useStateObservable(maxBlockSize$)
  const [queryInfo, setQueryInfo] = useState<{
    weight: Weight
    class: { type: "Normal" | "Operational" | "Mandatory" }
    partial_fee: bigint
  } | null>(null)
  const length = (extrinsic.length - 2) / 8
  const tip = txPayment?.tip ?? 0n

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setQueryInfo(null)
      const client = await firstValueFrom(client$)
      const result = await client
        .getUnsafeApi()
        .apis.TransactionPaymentApi.query_info(
          Binary.fromOpaque(extrinsic),
          length,
          {
            at: blockHex,
          },
        )
      if (!cancelled) {
        setQueryInfo(result as any)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [extrinsic, blockHex, length])

  if (!queryInfo) return null

  const priority = (() => {
    if (!maxBlockSize) return null
    const maxLength =
      maxBlockSize.length[
        queryInfo.class.type.toLocaleLowerCase() as keyof typeof maxBlockSize.length
      ]

    const maxTxPerBlockWeight = divWeight(
      maxBlockSize.maxWeight,
      queryInfo.weight,
    )
    const maxTxPerBlockLength = BigInt(Math.floor(maxLength / length))
    const maxTxPerBlock =
      maxTxPerBlockWeight < maxTxPerBlockLength
        ? maxTxPerBlockWeight
        : maxTxPerBlockLength
    const priority = (tip + 1n) * maxTxPerBlock
    const limitingFactor =
      maxTxPerBlockWeight < maxTxPerBlockLength ? "Weight" : "Length"

    return {
      priority,
      maxTxPerBlockLength,
      maxTxPerBlockWeight,
      maxTxPerBlock,
      limitingFactor,
    }
  })()

  return (
    <div className="space-y-4">
      {priority ? (
        <div className="flex flex-col gap-2 border-b border-foreground/10 pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/50">
              Computed Priority
            </div>
            <div className="mt-1 font-mono text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {priority.priority.toLocaleString()}
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
        <div className="rounded-lg border border-foreground/10 bg-foreground/5 p-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/50">
            Inputs
          </div>
          <div className="mt-3 space-y-2">
            <DetailRow label="Tip" value={<TokenAmount>{tip}</TokenAmount>} />
            <DetailRow
              label="Partial Fee"
              value={<TokenAmount>{queryInfo.partial_fee}</TokenAmount>}
            />
            <DetailRow label="Class" value={queryInfo.class.type} />
            <DetailRow label="Encoded Length" value={length.toLocaleString()} />
            <DetailRow
              label="Weight"
              value={`${(Number(queryInfo.weight.proof_size) / 1024).toLocaleString(undefined, { maximumSignificantDigits: 3 })} KB / ${(Number(queryInfo.weight.ref_time) / 1_000_000).toLocaleString(undefined, { maximumSignificantDigits: 3 })} ms`}
            />
          </div>
        </div>

        <div className="rounded-lg border border-foreground/10 bg-foreground/5 p-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/50">
            Capacity
          </div>
          <div className="mt-3 space-y-2">
            <DetailRow
              label="Tx/Block by Length"
              value={
                priority ? priority.maxTxPerBlockLength.toLocaleString() : "N/A"
              }
            />
            <DetailRow
              label="Tx/Block by Weight"
              value={
                priority ? priority.maxTxPerBlockWeight.toLocaleString() : "N/A"
              }
            />
            <DetailRow
              label="Limited By"
              value={priority ? priority.limitingFactor : "N/A"}
            />
          </div>
        </div>
      </div>

      {!priority ? (
        <div className="rounded-lg border border-foreground/10 bg-background/60 p-3 text-xs text-muted-foreground">
          Waiting for block limits to finish the priority calculation.
        </div>
      ) : null}
    </div>
  )
}

export const analyzePriority$ = maxBlockSize$

type Weight = { ref_time: bigint; proof_size: bigint }
const divWeight = (a: Weight, b: Weight) => {
  const ref_time = b.ref_time === 0n ? 1n : a.ref_time / b.ref_time
  const proof_size = b.proof_size === 0n ? 1n : a.proof_size / b.proof_size
  return ref_time < proof_size ? ref_time : proof_size
}

const DetailRow: FC<{ label: string; value: ReactNode }> = ({
  label,
  value,
}) => (
  <div className="flex items-baseline justify-between gap-4 border-b border-foreground/8 pb-2 last:border-b-0 last:pb-0">
    <div className="text-sm text-muted-foreground">{label}</div>
    <div className="text-right font-mono text-sm text-foreground">{value}</div>
  </div>
)
