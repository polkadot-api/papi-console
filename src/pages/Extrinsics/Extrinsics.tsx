import { runtimeCtx$ } from "@/state/chains/chain.state"
import { BinaryDisplay } from "@/codec-components/LookupTypeEdit"
import { ButtonGroup } from "@/components/ButtonGroup"
import { LoadingMetadata } from "@/components/Loading"
import { withSubscribe } from "@/components/withSuspense"
import {
  CodecComponentType,
  CodecComponentValue,
} from "@polkadot-api/react-builder"
import { Binary } from "@polkadot-api/substrate-bindings"
import { state, useStateObservable } from "@react-rxjs/core"
import { useState } from "react"
import { useLocation } from "react-router-dom"
import { map } from "rxjs"
import { EditMode } from "./EditMode"
import { JsonMode } from "./JsonMode"
import { ExtrinsicModal } from "./SubmitTx/SubmitTx"
import { twMerge } from "tailwind-merge"

const extrinsicProps$ = state(
  runtimeCtx$.pipe(
    map(({ dynamicBuilder, lookup }) => {
      const codecType =
        "call" in lookup.metadata.extrinsic
          ? lookup.metadata.extrinsic.call
          : // TODO v14 is this one?
            lookup.metadata.extrinsic.type
      return {
        metadata: lookup.metadata,
        codecType,
        codec: dynamicBuilder.buildDefinition(codecType),
      }
    }),
  ),
)

export const Extrinsics = withSubscribe(
  () => {
    const [viewMode, setViewMode] = useState<"edit" | "json">("edit")
    const extrinsicProps = useStateObservable(extrinsicProps$)
    const location = useLocation()

    const [componentValue, setComponentValue] = useState<CodecComponentValue>({
      type: CodecComponentType.Initial,
      value: location.hash.slice(1),
    })
    const binaryValue =
      (componentValue.type === CodecComponentType.Initial
        ? componentValue.value
        : componentValue.value.empty
          ? null
          : componentValue.value.encoded) ?? null

    return (
      <div
        className={twMerge(
          "flex flex-col overflow-hidden gap-2 p-4 pb-0",
          // Bypassing top-level scroll area, since we need a specific scroll area for the tree view
          "absolute w-full h-full max-w-screen-lg",
        )}
      >
        <BinaryDisplay
          {...extrinsicProps}
          value={componentValue}
          onUpdate={(value) =>
            setComponentValue({ type: CodecComponentType.Updated, value })
          }
        />

        <div className="flex flex-row justify-between px-2">
          <ButtonGroup
            value={viewMode}
            onValueChange={setViewMode as any}
            items={[
              {
                value: "edit",
                content: "Edit",
              },
              {
                value: "json",
                content: "JSON",
                disabled: !binaryValue,
              },
            ]}
          />
          <ExtrinsicModal callData={binaryValue ?? undefined} />
        </div>

        {viewMode === "edit" ? (
          <EditMode
            {...extrinsicProps}
            value={componentValue}
            onUpdate={(value) =>
              setComponentValue({ type: CodecComponentType.Updated, value })
            }
          />
        ) : (
          <JsonMode
            value={
              typeof binaryValue === "string"
                ? Binary.fromHex(binaryValue).asBytes()
                : binaryValue
            }
            decode={extrinsicProps.codec.dec}
          />
        )}
      </div>
    )
  },
  {
    fallback: <LoadingMetadata />,
  },
)
