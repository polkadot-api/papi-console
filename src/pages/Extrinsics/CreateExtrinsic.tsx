import { BinaryDisplay } from "@/codec-components/LookupTypeEdit"
import { ButtonGroup } from "@/components/ButtonGroup"
import { getHashParams, useSyncHashParam } from "@/hashParams"
import { runtimeCtx$, unsafeApi$ } from "@/state/chains/chain.state"
import {
  CodecComponentType,
  CodecComponentValue,
} from "@polkadot-api/react-builder"
import { state, useStateObservable } from "@react-rxjs/core"
import { createSignal } from "@react-rxjs/utils"
import { Binary } from "polkadot-api"
import { fromHex, toHex } from "polkadot-api/utils"
import { FC, useState } from "react"
import { catchError, concat, defer, map, of, switchMap, take } from "rxjs"
import { customSignedExtensions$ } from "./CustomSignedExt"
import { EditMode } from "./EditMode"
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

const [codecComponentChange$, setComponentValue] =
  createSignal<CodecComponentValue>()
const codecComponentValue$ = state(
  defer(() => {
    const hashParamsData = getHashParams(location).get("data")
    const initial$ = hashParamsData
      ? of(hashParamsData)
      : unsafeApi$.pipe(
          take(1),
          switchMap((v) =>
            v.tx.System.remark({ remark: new Uint8Array() }).getEncodedData(),
          ),
          catchError(() => [new Uint8Array()]),
          map(Binary.toHex),
        )

    return concat(
      initial$.pipe(
        map(
          (value): CodecComponentValue => ({
            type: CodecComponentType.Initial,
            value,
          }),
        ),
      ),
      codecComponentChange$,
    )
  }),
)

const getBinaryValue = (componentValue: CodecComponentValue) =>
  (componentValue.type === CodecComponentType.Initial
    ? typeof componentValue.value === "string"
      ? fromHex(componentValue.value)
      : componentValue.value
    : componentValue.value.empty
      ? null
      : componentValue.value.encoded) ?? null

export const CreateExtrinsic: FC = () => {
  return (
    <div className="border border-accent @max-3xl:space-y-2 @3xl:flex-1 @3xl:flex @3xl:gap-2">
      <ExtrinsicEditor />
      <SumbitExtrinsic />
    </div>
  )
}

const ExtrinsicEditor: FC = () => {
  const [viewMode, setViewMode] = useState<"edit" | "json">("edit")
  const componentValue = useStateObservable(codecComponentValue$)
  const binaryValue = getBinaryValue(componentValue)

  useSyncHashParam("data", [binaryValue], (v) =>
    v && v.length < 1024 * 1024 ? toHex(v) : null,
  )

  const extrinsicProps = useStateObservable(extrinsicProps$)

  return (
    <div className="flex flex-col overflow-hidden gap-2 pt-2 w-full @3xl:h-full">
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
          treeViewBreak="@max-3xl:hidden"
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

const SumbitExtrinsic: FC = () => {
  return <div>Submit</div>
}
