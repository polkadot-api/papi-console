import { BinaryDisplay } from "@/codec-components/LookupTypeEdit"
import { ButtonGroup } from "@/components/ButtonGroup"
import { LoadingMetadata } from "@/components/Loading"
import { withSubscribe } from "@/components/withSuspense"
import { getHashParams, setHashParams } from "@/hashParams"
import { runtimeCtx$ } from "@/state/chains/chain.state"
import {
  CodecComponentType,
  CodecComponentValue,
} from "@polkadot-api/react-builder"
import { Binary } from "@polkadot-api/substrate-bindings"
import { toHex } from "@polkadot-api/utils"
import { state, useStateObservable } from "@react-rxjs/core"
import { useLayoutEffect, useState } from "react"
import { useLocation } from "react-router-dom"
import { map } from "rxjs"
import { twMerge } from "tailwind-merge"
import { EditMode } from "./EditMode"
import { JsonMode } from "./JsonMode"
import { ExtrinsicModal } from "./SubmitTx/SubmitTx"
import { ActionButton } from "@/components/ActionButton"
import { Settings } from "lucide-react"
import { CustomSignedExt, customSignedExtensions$ } from "./CustomSignedExt"

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

const customExtensionsCount$ = state(
  customSignedExtensions$.pipe(
    map((v) => Object.keys(v).length),
    map((v) =>
      v ? (
        <div className="px-1.5 rounded-full bg-chart-1 text-white text-sm">
          {v}
        </div>
      ) : null,
    ),
  ),
  null,
)

export const Extrinsics = withSubscribe(
  () => {
    const [viewMode, setViewMode] = useState<"edit" | "json">("edit")
    const [editingExtensions, setEditingExtensions] = useState(false)
    const extrinsicProps = useStateObservable(extrinsicProps$)
    const location = useLocation()

    const [componentValue, setComponentValue] = useState<CodecComponentValue>({
      type: CodecComponentType.Initial,
      value: getHashParams(location).get("data") ?? "",
    })
    const binaryValue =
      (componentValue.type === CodecComponentType.Initial
        ? componentValue.value
        : componentValue.value.empty
          ? null
          : componentValue.value.encoded) ?? null

    useLayoutEffect(() => {
      if (binaryValue && binaryValue.length < 1024 * 1024) {
        setHashParams({
          data:
            typeof binaryValue === "string" ? binaryValue : toHex(binaryValue),
        })
      } else {
        setHashParams({
          data: null,
        })
      }
    }, [binaryValue])

    if (editingExtensions)
      return <CustomSignedExt onClose={() => setEditingExtensions(false)} />

    return (
      <div
        className={twMerge(
          "flex flex-col overflow-hidden gap-2 p-4 pb-0",
          // Bypassing top-level scroll area, since we need a specific scroll area for the tree view
          "absolute w-full h-full max-w-(--breakpoint-xl)",
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
          <div className="flex flex-row items-center gap-2">
            <ActionButton
              className="text-foreground/70 flex items-center gap-1"
              onClick={() => setEditingExtensions(true)}
            >
              {customExtensionsCount$}
              <Settings />
            </ActionButton>
            <ExtrinsicModal callData={binaryValue ?? undefined} />
          </div>
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
