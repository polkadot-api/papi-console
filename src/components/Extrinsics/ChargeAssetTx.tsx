import { client$ } from "@/state/chains/chain.state"
import { XcmV5Junctions } from "@polkadot-api/descriptors"
import {
  Binary,
  decAnyMetadata,
  unifyMetadata,
} from "@polkadot-api/substrate-bindings"
import { HexString } from "polkadot-api"
import { FC, useEffect, useState } from "react"
import { TokenAmount } from "../TokenAmount"

type ChargeAssetTxPayment = {
  tip: bigint
  // Add more supported types as we go
  asset_id?: {
    parents: number
    interior: XcmV5Junctions
  }
}

const getAsset = (value: ChargeAssetTxPayment) => {
  if (value.asset_id?.parents !== 0) return null
  if (value.asset_id.interior.type !== "X2") return null
  const [first, second] = value.asset_id.interior.value
  if (first.type !== "PalletInstance" || second.type !== "GeneralIndex")
    return null
  return {
    pallet: first.value,
    index: second.value,
  }
}
export const canDecodeAsset = (value: ChargeAssetTxPayment) =>
  getAsset(value) !== null

const loadAsset = async (
  asset: {
    pallet: number
    index: bigint
  },
  block?: HexString,
) => {
  const client = await client$.getValue()
  const metadata = unifyMetadata(
    decAnyMetadata(
      await client.getMetadata(
        block ?? (await client.getFinalizedBlock()).hash,
      ),
    ),
  )
  const pallet = metadata.pallets.find((p) => p.index === asset.pallet)
  if (!pallet) return null
  const hasMetadata = pallet.storage?.items.find((it) => it.name === "Metadata")
  if (!hasMetadata) return null
  const assetMetadata: any = await client
    .getUnsafeApi()
    .query[pallet.name].Metadata.getValue(Number(asset.index))
  if (assetMetadata.decimals == null) return null
  return {
    pallet: pallet.name,
    symbol: Binary.toText(assetMetadata.symbol) as string,
    decimals: assetMetadata.decimals as number,
  }
}

export const ChargeAssetTx: FC<{
  chargeAssetTxPayment: {
    tip: bigint
    // Add more types as we go
    asset_id?: {
      parents: number
      interior: XcmV5Junctions
    }
  }
}> = ({ chargeAssetTxPayment }) => {
  const asset = getAsset(chargeAssetTxPayment)
  const [assetMetadata, setAssetMetadata] = useState<{
    pallet: string
    symbol: string
    decimals: number
  } | null>(null)

  useEffect(() => {
    if (!asset) return

    let cancelled = false
    loadAsset(asset).then(
      (r) => !cancelled && setAssetMetadata(r),
      (ex) => console.error(ex),
    )
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset?.index, asset?.pallet])

  if (!asset || !assetMetadata) return null

  return (
    <span className="tabular-nums">
      <TokenAmount>{chargeAssetTxPayment.tip}</TokenAmount> in{" "}
      {assetMetadata.symbol
        ? `${assetMetadata.symbol} (${assetMetadata.pallet} #${asset.index})`
        : `${assetMetadata.pallet} #${asset.index}`}
    </span>
  )
}
