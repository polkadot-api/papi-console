import { TokenAmount } from "@/components/TokenAmount"
import { BlockContext } from "@/pages/Explorer/Detail/blockContext"
import { client$ } from "@/state/chains/chain.state"
import { polkadot_people } from "@polkadot-api/descriptors"
import { Binary, HexString } from "polkadot-api"
import { FC, ReactNode, useContext, useEffect, useState } from "react"

export const AnalyzePriority: FC<{
  txPayment?: { tip?: bigint }
  extrinsic: HexString
}> = ({ txPayment, extrinsic }) => {
  const blockHex = useContext(BlockContext)?.hash
  const details = usePriorityAnalysis({
    txPayment,
    extrinsic,
    blockHex,
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 border-b border-foreground/10 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/50">
            Computed Priority
          </div>
          <div className="mt-1 font-mono text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {details?.priority.toLocaleString() ?? "…"}
          </div>
        </div>
      </div>

      {details ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
          <div className="rounded-lg border border-foreground/10 bg-foreground/5 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/50">
              Inputs
            </div>
            <div className="mt-3 space-y-2">
              <DetailRow
                label="Tip"
                value={<TokenAmount>{details.tip}</TokenAmount>}
              />
              <DetailRow
                label="Fee"
                value={
                  <TokenAmount>{details.queryInfo.partial_fee}</TokenAmount>
                }
              />
              <DetailRow label="Class" value={details.queryInfo.class.type} />
              <DetailRow
                label="Encoded Length"
                value={details.length.toLocaleString()}
              />
              <DetailRow
                label="Weight"
                value={`${(Number(details.queryInfo.weight.proof_size) / 1024).toLocaleString(undefined, { maximumSignificantDigits: 3 })} KB / ${(Number(details.queryInfo.weight.ref_time) / 1_000_000).toLocaleString(undefined, { maximumSignificantDigits: 3 })} Mref`}
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
                value={details.maxTxPerBlockLength.toLocaleString()}
              />
              <DetailRow
                label="Tx/Block by Weight"
                value={details.maxTxPerBlockWeight.toLocaleString()}
              />
              <DetailRow label="Limited By" value={details.limitingFactor} />
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-foreground/10 bg-background/60 p-3 text-xs text-muted-foreground">
          Waiting for block limits to finish the priority calculation.
        </div>
      )}
    </div>
  )
}

export const PriorityValue: FC<{
  txPayment?: { tip?: bigint }
  extrinsic: HexString
}> = ({ txPayment, extrinsic }) => {
  const blockHex = useContext(BlockContext)?.hash
  const details = usePriorityAnalysis({
    txPayment,
    extrinsic,
    blockHex,
  })

  return details ? (
    <span className="font-mono text-sm text-foreground">
      {details.priority.toLocaleString()}
    </span>
  ) : (
    <span className="text-sm text-muted-foreground">…</span>
  )
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

const getPriority = async (
  extrinsic: HexString,
  txPayment: { tip?: bigint } | undefined,
  at?: HexString,
) => {
  const client = await client$.getValue()
  const typedApi = client.getTypedApi(polkadot_people)

  const extLength = (extrinsic.length - 2) / 2
  const tip = txPayment?.tip ?? 0n

  try {
    const [length, weights, queryInfo] = await Promise.all([
      typedApi.constants.System.BlockLength({
        at,
      }),
      typedApi.constants.System.BlockWeights({
        at,
      }),
      typedApi.apis.TransactionPaymentApi.query_info(
        Binary.fromOpaque(extrinsic),
        extLength,
        {
          at,
        },
      ),
    ])

    const maxLength =
      length.max[
        queryInfo.class.type.toLocaleLowerCase() as keyof typeof length.max
      ]

    const maxTxPerBlockWeight = divWeight(weights.max_block, queryInfo.weight)
    const maxTxPerBlockLength = BigInt(Math.floor(maxLength / extLength))
    const maxTxPerBlock =
      maxTxPerBlockWeight < maxTxPerBlockLength
        ? maxTxPerBlockWeight
        : maxTxPerBlockLength
    const priority = (tip + 1n) * maxTxPerBlock
    const limitingFactor =
      maxTxPerBlockWeight < maxTxPerBlockLength ? "Weight" : "Length"

    return {
      priority,
      length: extLength,
      queryInfo,
      tip,
      maxTxPerBlockLength,
      maxTxPerBlockWeight,
      maxTxPerBlock,
      limitingFactor,
    }
  } catch (ex) {
    console.error(ex)
    if (at) {
      // Might be the block was already unpinned and no archive support, try with latest block
      return getPriority(extrinsic, txPayment)
    }
    return null
  }
}
type PriorityDetails = Awaited<ReturnType<typeof getPriority>>

const usePriorityAnalysis = ({
  txPayment,
  extrinsic,
  blockHex,
}: {
  txPayment?: { tip?: bigint }
  extrinsic: HexString
  blockHex?: string
}) => {
  const [result, setResult] = useState<PriorityDetails | null>(null)

  useEffect(() => {
    let cancelled = false
    getPriority(extrinsic, txPayment, blockHex).then((r) => {
      if (cancelled) return
      setResult(r)
    })
    return () => {
      cancelled = true
    }
  }, [blockHex, extrinsic, txPayment])

  return result
}

type Weight = { ref_time: bigint; proof_size: bigint }
const divWeight = (a: Weight, b: Weight) => {
  const ref_time = b.ref_time === 0n ? 1n : a.ref_time / b.ref_time
  const proof_size = b.proof_size === 0n ? 1n : a.proof_size / b.proof_size
  return ref_time < proof_size ? ref_time : proof_size
}
