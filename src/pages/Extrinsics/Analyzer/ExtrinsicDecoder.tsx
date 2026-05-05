import { CopyBinary } from "@/codec-components/ViewCodec/CopyBinary"
import { AccountIdDisplay } from "@/components/AccountIdDisplay"
import { CopyText } from "@/components/Copy"
import { JsonDisplay } from "@/components/JsonDisplay"
import { blockInfoState$ } from "@/pages/Explorer/block.state"
import { BlockContext } from "@/pages/Explorer/Detail/blockContext"
import { SignedExtensions } from "@/pages/Explorer/Detail/SignedExtensions"
import { chainClient$ } from "@/state/chains/chain.state"
import { shortStr } from "@/utils"
import { getExtrinsicDecoder } from "@polkadot-api/tx-utils"
import { useStateObservable, withDefault } from "@react-rxjs/core"
import { HexString, TxCallData } from "polkadot-api"
import { fromHex, toHex } from "polkadot-api/utils"
import { FC, ReactNode, useMemo } from "react"
import { map, merge, switchMap } from "rxjs"
import { senderToAddress } from "../../Explorer/Detail/Extrinsic"
import { AnalyzePriority, analyzePriority$ } from "./Priority"
import { selectedBlock$, selectedBlockHex$ } from "./selectedBlock"

const extDecoder$ = selectedBlock$.pipeState(
  map((block) => getExtrinsicDecoder(block.ctx.metadataRaw)),
)

const selectedBlockInfo$ = selectedBlockHex$.pipeState(
  switchMap((hex) => (hex ? blockInfoState$(hex) : [null])),
  withDefault(null),
)

const hasher$ = chainClient$.pipeState(
  switchMap((v) => v.chainHead.hasher$),
  withDefault(null),
)

export const ExtrinsicDecoder: FC<{
  extrinsic: HexString
}> = ({ extrinsic }) => {
  const hasher = useStateObservable(hasher$)
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
  const txHash = useMemo(
    () => (hasher ? toHex(hasher(fromHex(extrinsic))) : null),
    [extrinsic, hasher],
  )

  if (decodeResult.type === "error") {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-700 dark:text-red-300">
        <div className="text-xs font-semibold uppercase tracking-[0.2em]">
          Decode Error
        </div>
        <div className="mt-2">
          Can&apos;t decode: {decodeResult.value.message}
        </div>
      </div>
    )
  }

  const decoded = decodeResult.value
  const signerAddress =
    decoded.type === "signed" ? senderToAddress(decoded.address) : null

  return (
    <BlockContext value={block}>
      <div className="space-y-4">
        <SectionCard className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground/60">
                Decoded Extrinsic
              </div>
              <h2 className="text-2xl font-semibold tracking-tight capitalize">
                {decoded.type} Transaction v{decoded.version}
              </h2>
              <div className="text-sm text-muted-foreground">
                <p>
                  {decoded.call.type}.{decoded.call.value.type}
                </p>
                <p>
                  Hash: {txHash ? shortStr(txHash, 14) : null}{" "}
                  <CopyText text={txHash ?? ""} />
                </p>
              </div>
            </div>

            {signerAddress ? (
              <div className="rounded-lg border border-foreground/10 bg-foreground/5 px-3 py-2">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/50">
                  Signer
                </div>
                <div className="mt-1">
                  <AccountIdDisplay value={signerAddress} />
                </div>
              </div>
            ) : null}
          </div>
        </SectionCard>

        {decoded.type === "signed" ? (
          <SectionCard title="Signed Extensions">
            <SignedExtensions extra={decoded.extra} title={false} />
          </SectionCard>
        ) : decoded.type === "general" ? (
          <SectionCard>
            <div className="text-sm text-muted-foreground">
              General transaction analysis is not implemented yet.
            </div>
          </SectionCard>
        ) : null}
        <SectionCard title="Priority Analysis">
          <AnalyzePriority extrinsic={extrinsic} />
        </SectionCard>
        <CallData
          call={decoded.call as TxCallData}
          callData={decoded.callData}
        />
      </div>
    </BlockContext>
  )
}

const CallData: FC<{ call: TxCallData; callData: Uint8Array }> = ({
  call,
  callData,
}) => (
  <SectionCard title="Call Payload">
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-lg font-semibold tracking-tight">
            {call.type}.{call.value.type}
          </div>
          <p className="text-sm text-muted-foreground">
            Decoded arguments for the call embedded in this extrinsic.
          </p>
        </div>
        <div className="min-w-0 rounded-lg border border-foreground/10 bg-foreground/5 px-3 py-2 lg:max-w-xl">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/50">
            Call Data
          </div>
          <div className="mt-1 flex items-start gap-2">
            <div className="shrink overflow-auto font-mono text-xs text-muted-foreground">
              {toHex(callData)}
            </div>
            <CopyBinary value={callData} />
          </div>
        </div>
      </div>
      <div className="overflow-auto rounded-xl border border-foreground/10 bg-background/60 p-3">
        <JsonDisplay src={call.value.value} />
      </div>
    </div>
  </SectionCard>
)

export const extrinsicDecoder$ = merge(extDecoder$, analyzePriority$)

const SectionCard: FC<{
  children: ReactNode
  title?: string
  className?: string
}> = ({ children, title, className }) => (
  <section
    className={[
      "rounded-xl border border-foreground/10 bg-card p-4 shadow-sm",
      className,
    ]
      .filter(Boolean)
      .join(" ")}
  >
    {title ? (
      <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-foreground/60">
        {title}
      </div>
    ) : null}
    {children}
  </section>
)
