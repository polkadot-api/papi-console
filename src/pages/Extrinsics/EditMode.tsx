import {
  Marker,
  MarkersContextProvider,
  VisibleWindow,
} from "@/codec-components/common/Markers"
import { synchronizeScroll } from "@/codec-components/common/scroll"
import { SubtreeFocus } from "@/codec-components/common/SubtreeFocus"
import { EditCodec } from "@/codec-components/EditCodec"
import { TreeCodec } from "@/codec-components/EditCodec/Tree/index"
import { FocusPath } from "@/codec-components/LookupTypeEdit"
import {
  CodecComponentUpdate,
  CodecComponentValue,
} from "@polkadot-api/react-builder"
import { UnifiedMetadata } from "@polkadot-api/substrate-bindings"
import { useEffect, useRef, useState } from "react"

export const EditMode: React.FC<{
  codecType: number
  metadata: UnifiedMetadata
  value: CodecComponentValue
  onUpdate: (value: CodecComponentUpdate) => void
}> = (props) => {
  const { metadata, codecType, value } = props
  const treeRef = useRef<HTMLDivElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!listRef.current || !treeRef.current) return
    return synchronizeScroll(listRef.current, treeRef.current)
  }, [])

  const [focusingSubtree, setFocusingSubtree] = useState<string[] | null>(null)

  return (
    <div className="flex flex-col items-start overflow-hidden">
      <FocusPath
        metadata={metadata}
        typeId={codecType}
        value={focusingSubtree}
        onFocus={setFocusingSubtree}
      />
      <SubtreeFocus
        value={{ callback: setFocusingSubtree, path: focusingSubtree }}
      >
        <MarkersContextProvider>
          <div
            ref={listRef}
            className="flex flex-row overflow-auto w-full gap-2"
          >
            <div
              ref={treeRef}
              className="min-w-fit w-96 sticky top-0 pl-2 pb-16 leading-loose overflow-hidden max-sm:hidden text-sm"
            >
              <div className="relative">
                {!value.value ? (
                  <div className="text-sm text-foreground/50 py-1">(Empty)</div>
                ) : (
                  <TreeCodec {...props} />
                )}
                <VisibleWindow />
              </div>
            </div>
            <div className="flex-1">
              <div className="p-2">
                <Marker id={[]} />
                <EditCodec {...props} />
              </div>
            </div>
          </div>
        </MarkersContextProvider>
      </SubtreeFocus>
    </div>
  )
}
