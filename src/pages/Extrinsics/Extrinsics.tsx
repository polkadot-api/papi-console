import { BinaryDisplay } from "@/codec-components/LookupTypeEdit"
import { ActionButton, actionButtonClassName } from "@/components/ActionButton"
import { ButtonGroup } from "@/components/ButtonGroup"
import { LoadingMetadata } from "@/components/Loading"
import { withSubscribe } from "@/components/withSuspense"
import { getHashParams, Link, useSyncHashParam } from "@/hashParams"
import { runtimeCtx$ } from "@/state/chains/chain.state"
import { cn } from "@/utils"
import {
  CodecComponentType,
  CodecComponentValue,
} from "@polkadot-api/react-builder"
import { state, useStateObservable } from "@react-rxjs/core"
import { FileSearch, Settings } from "lucide-react"
import { fromHex, toHex } from "polkadot-api/utils"
import { FC, useState } from "react"
import { Route, Routes, useLocation } from "react-router-dom"
import { map } from "rxjs"
import { twMerge } from "tailwind-merge"
import { CustomSignedExt, customSignedExtensions$ } from "./CustomSignedExt"
import { EditMode } from "./EditMode"
import { ExtrinsicAnalyzer } from "./Analyzer/ExtrinsicAnalyzer"
import { JsonMode } from "./JsonMode"
import { ExtrinsicModal } from "./SubmitTx/SubmitTx"

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
    const location = useLocation()

    const [componentValue, setComponentValue] = useState<CodecComponentValue>({
      type: CodecComponentType.Initial,
      value: getHashParams(location).get("data") ?? "",
    })
    const binaryValue =
      (componentValue.type === CodecComponentType.Initial
        ? typeof componentValue.value === "string"
          ? fromHex(componentValue.value)
          : componentValue.value
        : componentValue.value.empty
          ? null
          : componentValue.value.encoded) ?? null

    useSyncHashParam("data", [binaryValue], (v) =>
      v && v.length < 1024 * 1024 ? toHex(v) : null,
    )

    return (
      <Routes>
        <Route path="analyzer" element={<ExtrinsicAnalyzer />} />
        <Route
          path="*"
          element={
            <ExtrinsicEditor
              componentValue={componentValue}
              onValueChange={setComponentValue}
              binaryValue={binaryValue}
            />
          }
        />
      </Routes>
    )
  },
  {
    fallback: <LoadingMetadata />,
  },
)

const ExtrinsicEditor: FC<{
  componentValue: CodecComponentValue
  onValueChange: (value: CodecComponentValue) => void
  binaryValue: Uint8Array | null
}> = ({ componentValue, onValueChange, binaryValue }) => {
  const [viewMode, setViewMode] = useState<"edit" | "json">("edit")
  const [page, setPage] = useState<"extensions" | null>(null)
  const extrinsicProps = useStateObservable(extrinsicProps$)

  if (page === "extensions")
    return <CustomSignedExt onClose={() => setPage(null)} />

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
          onValueChange({ type: CodecComponentType.Updated, value })
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
          <Link
            to="/extrinsics/analyzer"
            className={cn(
              actionButtonClassName(),
              "text-foreground/70 flex items-center gap-1",
            )}
          >
            <FileSearch />
          </Link>
          <ActionButton
            className="text-foreground/70 flex items-center gap-1"
            onClick={() => setPage("extensions")}
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
            onValueChange({ type: CodecComponentType.Updated, value })
          }
        />
      ) : (
        <JsonMode
          value={
            typeof binaryValue === "string" ? fromHex(binaryValue) : binaryValue
          }
          decode={extrinsicProps.codec.dec}
        />
      )}
    </div>
  )
}
