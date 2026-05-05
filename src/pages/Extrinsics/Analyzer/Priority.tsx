import { client$ } from "@/state/chains/chain.state"
import { polkadot_people } from "@polkadot-api/descriptors"
import { state, useStateObservable } from "@react-rxjs/core"
import { Binary, HexString } from "polkadot-api"
import { FC, useEffect, useState } from "react"
import { combineLatest, firstValueFrom, switchMap } from "rxjs"
import { selectedBlockHex$ } from "./selectedBlock"

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

    return { priority, maxTxPerBlockLength, maxTxPerBlockWeight }
  })()

  return (
    <div>
      <b>Priority:</b> tip={tip.toLocaleString()} fee=
      {queryInfo.partial_fee.toLocaleString()} class={queryInfo.class.type}{" "}
      weight=
      {queryInfo.weight.proof_size.toLocaleString() +
        "/" +
        queryInfo.weight.ref_time.toLocaleString()}{" "}
      {priority ? (
        <>
          txPerBlockLength={priority.maxTxPerBlockLength.toLocaleString()}{" "}
          txPerBlockWeight={priority.maxTxPerBlockWeight.toLocaleString()}{" "}
          priority={priority.priority.toLocaleString()}
        </>
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
