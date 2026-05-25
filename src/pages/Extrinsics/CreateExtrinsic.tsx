import { BinaryDisplay } from "@/codec-components/LookupTypeEdit"
import { ButtonGroup } from "@/components/ButtonGroup"
import { useSyncHashParam } from "@/hashParams"
import { runtimeCtx$ } from "@/state/chains/chain.state"
import { CodecComponentType } from "@polkadot-api/react-builder"
import { state, useStateObservable } from "@react-rxjs/core"
import { fromHex, toHex } from "polkadot-api/utils"
import { FC, useRef, useState } from "react"
import { map } from "rxjs"
import { EditMode } from "./EditMode"
import { JsonMode } from "./JsonMode"
import { SubmitExtrinsic } from "./SubmitTx/SubmitExtrinsic"
import {
  codecComponentValue$,
  getBinaryValue,
  setComponentValue,
} from "./componentValue.state"
import { ActionButton } from "@/components/ActionButton"

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

export const CreateExtrinsic: FC = () => {
  const submitRef = useRef<HTMLElement>(null)

  return (
    <div className="border border-accent overflow-hidden @max-6xl:overflow-auto @max-6xl:space-y-2 @4xl:flex-1 @4xl:flex @4xl:gap-2">
      <ExtrinsicEditor
        onScrollToSubmit={() =>
          submitRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          })
        }
      />
      <SubmitExtrinsic ref={submitRef} />
    </div>
  )
}

const ExtrinsicEditor: FC<{ onScrollToSubmit: () => void }> = ({
  onScrollToSubmit,
}) => {
  const [viewMode, setViewMode] = useState<"edit" | "json">("edit")
  const componentValue = useStateObservable(codecComponentValue$)
  const binaryValue = getBinaryValue(componentValue)

  useSyncHashParam("data", [binaryValue], (v) =>
    v && v.length < 1024 * 1024 ? toHex(v) : null,
  )

  const extrinsicProps = useStateObservable(extrinsicProps$)

  return (
    <div className="flex flex-col overflow-hidden gap-2 pt-2 w-full @6xl:h-full">
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
        <div className="flex flex-row items-center gap-2 @4xl:hidden">
          <ActionButton onClick={onScrollToSubmit}>
            Scroll to submit
          </ActionButton>
        </div>
      </div>

      {viewMode === "edit" ? (
        <EditMode
          {...extrinsicProps}
          value={componentValue}
          onUpdate={(value) =>
            setComponentValue({ type: CodecComponentType.Updated, value })
          }
          treeViewBreak="@max-6xl:hidden"
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
