import { runtimeCtx$ } from "@/state/chains/chain.state"
import { byteArraysAreEqual } from "@/utils/byteArray"
import {
  CodecComponentType,
  CodecComponentValue,
} from "@polkadot-api/react-builder"
import { state, useStateObservable } from "@react-rxjs/core"
import { Codec } from "polkadot-api"
import { ComponentProps, FC, useEffect, useState } from "react"
import { map } from "rxjs"
import { twMerge } from "tailwind-merge"
import {
  Marker,
  MarkersContextProvider,
  VisibleWindow,
} from "../common/Markers"
import { synchronizeScroll } from "../common/scroll"
import { SubtreeFocus } from "../common/SubtreeFocus"
import { EditCodec } from "../EditCodec"
import { TreeCodec } from "../EditCodec/Tree"
import { BinaryDisplay } from "./BinaryDisplay"
import { FocusPath } from "./FocusPath"
import { cn } from "@/lib/utils"

const editTypeMetadataProps$ = state(
  runtimeCtx$.pipe(
    map(({ dynamicBuilder, lookup }) => ({
      builder: dynamicBuilder,
      metadata: lookup.metadata,
    })),
  ),
  null,
)

export const LookupTypeEdit: FC<{
  type: number
  value: Uint8Array | "partial" | null
  onValueChange: (value: Uint8Array | "partial" | null) => void
  tree?: boolean
  className?: string
}> = ({ type, value, onValueChange, tree = true, className }) => {
  const [treeRef, setTreeRef] = useState<HTMLDivElement | null>(null)
  const [listRef, setListRef] = useState<HTMLDivElement | null>(null)
  const [focusingSubtree, setFocusingSubtree] = useState<string[] | null>(null)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    if (!listRef || !treeRef) return
    return synchronizeScroll(listRef, treeRef)
  }, [listRef, treeRef])

  const codecProps = useCodecProps(type, value, onValueChange)

  if (!codecProps) return null

  return (
    <div
      className={twMerge(
        "flex flex-col items-start overflow-hidden",
        className,
      )}
    >
      <BinaryDisplay {...codecProps} className="pb-2" />
      {tree && (
        <FocusPath
          metadata={codecProps.metadata}
          typeId={type}
          value={focusingSubtree}
          onFocus={setFocusingSubtree}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((c) => !c)}
        />
      )}
      <SubtreeFocus
        value={{ callback: setFocusingSubtree, path: focusingSubtree }}
      >
        <MarkersContextProvider>
          <div
            ref={setListRef}
            className="flex flex-row overflow-auto w-full gap-2"
          >
            {tree && (
              <div
                ref={setTreeRef}
                className={cn(
                  "w-96 sticky top-0 pl-2 pb-16 leading-loose overflow-hidden max-sm:hidden",
                  {
                    hidden: collapsed,
                  },
                )}
              >
                <div className="relative">
                  <TreeCodec {...codecProps} />
                  <VisibleWindow />
                </div>
              </div>
            )}
            <div className="flex-1">
              <div className="p-2 rounded">
                <Marker id={[]} />
                <EditCodec {...codecProps} />
              </div>
            </div>
          </div>
        </MarkersContextProvider>
      </SubtreeFocus>
    </div>
  )
}

export const InlineLookupTypeEdit: FC<{
  type: number
  value: Uint8Array | "partial" | null
  onValueChange: (value: Uint8Array | "partial" | null) => void
}> = ({ type, value, onValueChange }) => {
  const props = useCodecProps(type, value, onValueChange)
  if (!props) return null

  return <EditCodec {...props} />
}

const useCodecProps = (
  type: number,
  value: Uint8Array | "partial" | null,
  onValueChange: (value: Uint8Array | "partial" | null) => void,
): (ComponentProps<typeof EditCodec> & { codec: Codec<any> }) | null => {
  const [componentValue, setComponentValue] = useState<CodecComponentValue>({
    type: CodecComponentType.Initial,
    value: value instanceof Uint8Array ? value : undefined,
  })
  const metadataProps = useStateObservable(editTypeMetadataProps$)
  const codec = metadataProps?.builder.buildDefinition(type)

  // Synchronize componentValue out to `props.value`
  useEffect(() => {
    if (componentValue.type === CodecComponentType.Initial) return
    if (componentValue.value.empty) {
      if (value) onValueChange(null)
      return
    }
    if (!codec) return
    const encodedValue = (() => {
      if (componentValue.value.encoded) return componentValue.value.encoded
      try {
        return codec.enc(componentValue.value.decoded)
      } catch (_) {
        return null
      }
    })()
    if (!encodedValue) {
      if (value !== "partial") onValueChange("partial")
      return
    }
    if (
      !(value instanceof Uint8Array) ||
      !byteArraysAreEqual(encodedValue, value)
    ) {
      onValueChange(encodedValue)
    }
    return
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [componentValue])

  // Synchronize `props.value` in to componentValue
  useEffect(() => {
    const currentValue =
      (componentValue.type === CodecComponentType.Initial
        ? componentValue.value
        : componentValue.value.empty
          ? null
          : (componentValue.value.encoded ?? componentValue.value.decoded)) ??
      null

    if (value === null) {
      if (currentValue !== null)
        setComponentValue({
          type: CodecComponentType.Updated,
          value: {
            empty: true,
          },
        })
      return
    }

    if (value === "partial" || !codec) return

    const encodedValue = (() => {
      if (!currentValue) return null
      if (currentValue instanceof Uint8Array) {
        return currentValue
      }
      try {
        return codec.enc(value)
      } catch (_) {
        return null
      }
    })()
    if (!encodedValue || byteArraysAreEqual(encodedValue, value)) {
      const decoded = codec.dec(value)
      setComponentValue({
        type: CodecComponentType.Updated,
        value: {
          empty: false,
          decoded,
          encoded: value,
        },
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  if (!metadataProps || !codec) return null

  return {
    codec,
    codecType: type,
    metadata: metadataProps.metadata,
    value: componentValue,
    onUpdate: (value) =>
      setComponentValue({
        type: CodecComponentType.Updated,
        value,
      }),
  }
}
