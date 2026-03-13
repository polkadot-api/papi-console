import { CopyBinary } from "@/codec-components/ViewCodec/CopyBinary"
import { JsonDisplay } from "@/components/JsonDisplay"
import { TextInputField } from "@/components/TextInputField"
import { Button } from "@/components/ui/button"
import { client$ } from "@/state/chains/chain.state"
import { polkadot_people } from "@polkadot-api/descriptors"
import { DecodedExtrinsic, getExtrinsicDecoder } from "@polkadot-api/tx-utils"
import { state, Subscribe, useStateObservable } from "@react-rxjs/core"
import { ChevronLeft } from "lucide-react"
import { Binary, HexString, TxCallData } from "polkadot-api"
import { toHex } from "polkadot-api/utils"
import { FC, useEffect, useMemo, useState } from "react"
import { combineLatest, firstValueFrom, map, merge, switchMap } from "rxjs"
import { Sender, SignedExtensions } from "../Explorer/Detail/Extrinsic"
import { BlockPicker, selectedBlock$ } from "../Storage/BlockPicker"

const extDecoder$ = state(
  selectedBlock$.pipe(
    map((block) => getExtrinsicDecoder(block.ctx.metadataRaw)),
  ),
)
const selectedBlockHex$ = state(selectedBlock$.pipe(map((v) => v.hash)))

export const ExtrinsicAnalyzer: FC<{ onClose: () => void }> = ({ onClose }) => {
  const [extrinsicHex, setExtrinsicHex] = useState("")

  return (
    <div className="p-2 space-y-2">
      <div className="flex items-center gap-2">
        <Button
          className="has-[>svg]:px-1"
          type="button"
          variant="ghost"
          onClick={onClose}
        >
          <ChevronLeft />
        </Button>
        <h2 className="text-lg font-bold">Analyze Extrinsic</h2>
      </div>
      <div className="flex items-center gap-1 flex-wrap">
        <div>
          <label>
            Block
            <BlockPicker />
          </label>
        </div>
        <div className="grow">
          <label>
            Extrinsic
            <TextInputField
              className="w-full"
              value={extrinsicHex}
              onChange={setExtrinsicHex}
              placeholder="Extrinsic Hex"
            />
          </label>
        </div>
      </div>
      <Subscribe source$={extAnalyzer$} fallback={null}>
        {extrinsicHex ? <DecodeExtrinsic extrinsic={extrinsicHex} /> : null}
      </Subscribe>
    </div>
  )
}

const DecodeExtrinsic: FC<{
  extrinsic: HexString
}> = ({ extrinsic }) => {
  const extrinsicDecoder = useStateObservable(extDecoder$)
  const decodeResult = useMemo(() => {
    try {
      return {
        type: "success" as const,
        value: extrinsicDecoder(extrinsic),
      }
    } catch (ex) {
      console.error(ex)
      return {
        type: "error" as const,
        value: ex as Error,
      }
    }
  }, [extrinsicDecoder, extrinsic])

  if (decodeResult.type === "error") {
    return <div>Can't decode: {decodeResult.value.message}</div>
  }

  const decoded = decodeResult.value

  return (
    <div>
      <h2 className="capitalize text-xl font-bold">
        {decoded.type} Transaction v{decoded.version}
      </h2>
      {decoded.type === "signed" ? (
        <SignedInfo extrinsic={extrinsic} decoded={decoded} />
      ) : decoded.type === "general" ? (
        <div>TODO</div>
      ) : (
        <AnalyzePriority extrinsic={extrinsic} />
      )}
      <CallData call={decoded.call as TxCallData} callData={decoded.callData} />
    </div>
  )
}

const SignedInfo: FC<{
  extrinsic: HexString
  decoded: DecodedExtrinsic & { type: "signed" }
}> = ({ extrinsic, decoded }) => {
  const mortality = decoded.extra.CheckMortality
  const txPayment =
    decoded.extra.ChargeAssetTxPayment ?? decoded.extra.ChargeTxPayment

  return (
    <div className="space-y-2 mb-4">
      <Sender sender={decoded.address} />
      <SignedExtensions extra={decoded.extra} />
      {mortality ? <AnalyzeMortality mortality={mortality} /> : null}
      <AnalyzePriority extrinsic={extrinsic} txPayment={txPayment ?? {}} />
    </div>
  )
}

const CallData: FC<{ call: TxCallData; callData: Uint8Array }> = ({
  call,
  callData,
}) => (
  <div>
    <div className="flex gap-2 items-baseline">
      <div className="text-lg">
        {call.type}.{call.value.type}
      </div>
      <div className="flex gap-1 items-center overflow-hidden">
        <div className="shrink overflow-hidden text-ellipsis text-muted-foreground">
          {toHex(callData)}
        </div>
        <CopyBinary value={callData} />
      </div>
    </div>
    <JsonDisplay src={call.value.value} />
  </div>
)

const selectedBlockNumber$ = state(
  combineLatest([selectedBlockHex$, client$]).pipe(
    switchMap(([selectedBlock, client]) =>
      selectedBlock
        ? (client
            .getTypedApi(polkadot_people)
            .query.System.Number.getValue({
              at: selectedBlock,
            })
            .catch(() => null) as Promise<number | null>)
        : client.finalizedBlock$.pipe(map((block) => block.number)),
    ),
  ),
)

const AnalyzeMortality: FC<{ mortality: { type: string; value: number } }> = ({
  mortality,
}) => {
  const selectedBlockNumber = useStateObservable(selectedBlockNumber$)

  if (mortality.type === "Immortal") return null
  const parseResult = /^Mortal(\d+)$/.exec(mortality.type)
  if (parseResult === null) return null
  const first = BigInt(parseResult[1])
  const second = BigInt(mortality.value)
  // from polkadot-sdk primitives runtime generic era fn decode
  const encoded = first + (second << 8n)
  const period = Number(2n << (encoded % (1n << 4n)))
  const factor = period >> 12 || 1
  const phase = Number(encoded >> 4n) * factor

  // From fn birth
  const birthBlock = selectedBlockNumber
    ? Math.floor((Math.max(selectedBlockNumber, phase) - phase) / period) *
        period +
      phase
    : null

  const referencedBlocks = birthBlock
    ? new Array(5)
        .fill(0)
        .map((_, i) => (birthBlock - period * i).toLocaleString())
    : null

  return (
    <div>
      <b>Mortality:</b> period={period} phase={phase}{" "}
      {referencedBlocks ? (
        <>
          currentBlock={selectedBlockNumber?.toLocaleString()} nextPeriod=
          {(birthBlock! + period).toLocaleString()} oldPeriods=
          {referencedBlocks.join(" ")}
        </>
      ) : null}
    </div>
  )
}

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
          length,
          maxWeight: weights.max_block,
        }),
        () => null,
      ),
    ),
  ),
)

const AnalyzePriority: FC<{
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
      console.log(extrinsic.length)
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
    console.log(queryInfo)
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

const extAnalyzer$ = merge(
  extDecoder$,
  selectedBlockHex$,
  selectedBlockNumber$,
  maxBlockSize$,
)

type Weight = { ref_time: bigint; proof_size: bigint }
const divWeight = (a: Weight, b: Weight) => {
  const ref_time = b.ref_time === 0n ? 1n : a.ref_time / b.ref_time
  const proof_size = b.proof_size === 0n ? 1n : a.proof_size / b.proof_size
  return ref_time < proof_size ? ref_time : proof_size
}
