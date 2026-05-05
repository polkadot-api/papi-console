import { CopyBinary } from "@/codec-components/ViewCodec/CopyBinary"
import { JsonDisplay } from "@/components/JsonDisplay"
import { blockInfoState$ } from "@/pages/Explorer/block.state"
import { BlockContext } from "@/pages/Explorer/Detail/blockContext"
import { SignedExtensions } from "@/pages/Explorer/Detail/SignedExtensions"
import { DecodedExtrinsic, getExtrinsicDecoder } from "@polkadot-api/tx-utils"
import { useStateObservable, withDefault } from "@react-rxjs/core"
import { HexString, TxCallData } from "polkadot-api"
import { toHex } from "polkadot-api/utils"
import { FC, useMemo } from "react"
import { map, merge, switchMap } from "rxjs"
import { Sender } from "../../Explorer/Detail/Extrinsic"
import { AnalyzePriority, analyzePriority$ } from "./Priority"
import { selectedBlock$, selectedBlockHex$ } from "./selectedBlock"

const extDecoder$ = selectedBlock$.pipeState(
  map((block) => getExtrinsicDecoder(block.ctx.metadataRaw)),
)

const selectedBlockInfo$ = selectedBlockHex$.pipeState(
  switchMap((hex) => (hex ? blockInfoState$(hex) : [null])),
  withDefault(null),
)

export const ExtrinsicDecoder: FC<{
  extrinsic: HexString
}> = ({ extrinsic }) => {
  const block = useStateObservable(selectedBlockInfo$)
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
    <BlockContext value={block}>
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
        <CallData
          call={decoded.call as TxCallData}
          callData={decoded.callData}
        />
      </div>
    </BlockContext>
  )
}

const SignedInfo: FC<{
  extrinsic: HexString
  decoded: DecodedExtrinsic & { type: "signed" }
}> = ({ extrinsic, decoded }) => {
  const txPayment =
    decoded.extra.ChargeAssetTxPayment ?? decoded.extra.ChargeTxPayment

  return (
    <div className="space-y-2 mb-4">
      <Sender sender={decoded.address} />
      <SignedExtensions extra={decoded.extra} />
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

export const extrinsicDecoder$ = merge(extDecoder$, analyzePriority$)
