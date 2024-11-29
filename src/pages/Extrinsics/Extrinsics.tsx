import { BinaryDisplay } from "@/codec-components/LookupTypeEdit"
import { ButtonGroup } from "@/components/ButtonGroup"
import { LoadingMetadata } from "@/components/Loading"
import { withSubscribe } from "@/components/withSuspense"
import { runtimeCtx$ } from "@/state/chains/chain.state"
import {
  CodecComponentType,
  CodecComponentValue,
} from "@polkadot-api/react-builder"
import { Binary } from "@polkadot-api/substrate-bindings"
import { state, useStateObservable } from "@react-rxjs/core"
import { useState } from "react"
import { useLocation } from "react-router-dom"
import { map } from "rxjs"
import { twMerge } from "tailwind-merge"
import { EditMode } from "./EditMode"
import { JsonMode } from "./JsonMode"
import { ExtrinsicModal } from "./SubmitTx/SubmitTx"
// import { MetadataLookup } from "@polkadot-api/metadata-builders"

// const enhanceSystemStorage = (lookup: MetadataLookup) => {
//   const system = lookup.metadata.pallets.find((p) => p.name === "System")
//   const calls = system?.calls && lookup(system.calls)
//   if (!calls || calls.type !== "enum") return lookup

//   const getEntry = (call: string) => {
//     const x = calls.value[call]
//     if (!("value" in x)) return null
//     const value = x.value
//     if (Array.isArray(value)) return value[0] ?? null
//     if (typeof value.type === "string") return value
//     return Object.values(value)[0] ?? null
//   }

//   const setStorage = getEntry("set_storage")
//   if (setStorage?.type === "sequence" && setStorage.value.type === "array") {
//     const originalLookup = lookup.metadata.lookup[setStorage.value.id]
//     originalLookup.path = ["System::SetStorage", ...originalLookup.path]
//   }

//   const killStorage = getEntry("kill_storage")
//   if (killStorage) {
//     const originalLookup = lookup.metadata.lookup[killStorage.id]
//     originalLookup.path = ["System::KillStorage", ...originalLookup.path]
//   }
//   return lookup
// }

const extrinsicProps$ = state(
  runtimeCtx$.pipe(
    map(({ dynamicBuilder, lookup }) => {
      const codecType =
        "call" in lookup.metadata.extrinsic
          ? lookup.metadata.extrinsic.call
          : // TODO v14 is this one?
            lookup.metadata.extrinsic.type
      return {
        lookup,
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
