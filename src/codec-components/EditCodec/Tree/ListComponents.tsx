import { TypeIcons } from "@/components/Icons"
import { useHeightObserver } from "@/components/useHeightObserver"
import {
  EditArray,
  EditComplexCodecComponentProps,
  EditSequence,
  EditTuple,
  NOTIN,
} from "@polkadot-api/react-builder"
import { useStateObservable } from "@react-rxjs/core"
import { GripVertical, Trash2 } from "lucide-react"
import React, {
  FC,
  PropsWithChildren,
  ReactNode,
  useRef,
  useState,
} from "react"
import { twMerge } from "tailwind-merge"
import { isCollapsedRoot$ } from "../../common/paths.state"
import { scrollToMarker } from "../../common/scroll"
import { useSubtreeFocus } from "../../common/SubtreeFocus"
import {
  BinaryStatus,
  ChildrenProviders,
  ItemTitle,
  useReportBinaryStatus,
} from "./codec-components"

export const CSequence: EditSequence = (props) => (
  <ListDisplay {...props} rearrange />
)

export const CArray: EditArray = (props) => (
  <ListDisplay {...props} fixedLength rearrange />
)

export const CTuple: EditTuple = (props) => (
  <ListDisplay {...props} fixedLength />
)

interface DragProps {
  onMeasure: (height: number) => void
  onDragStart: () => void
  onDragMove: (offset: number) => void
  onDragEnd: (offset: number) => void
  rearranging: boolean
  translation: number
}

export const ListDisplay: React.FC<
  EditComplexCodecComponentProps<unknown[]> & {
    innerComponents: ReactNode[]
    fixedLength?: boolean
    rearrange?: boolean
  }
> = (props) => {
  const {
    innerComponents,
    fixedLength,
    type,
    onValueChanged,
    value,
    path,
    encodedValue,
    decode,
    rearrange = false,
  } = props
  const drag = useDrag(rearrange, props)
  const focus = useSubtreeFocus()
  useReportBinaryStatus(type, encodedValue, onValueChanged, decode)
  const sub = focus.getNextPath(path)
  if (sub) {
    return innerComponents[Number(sub)]
  }

  const onDelete = (idx: number) => {
    if (value === NOTIN) return
    onValueChanged(value.filter((_, i) => i !== idx))
  }

  return (
    <div>
      {innerComponents.map((component, idx) => {
        const innerPath = [...path, String(idx)]

        return (
          <ListItem
            key={idx}
            idx={idx}
            path={innerPath.join(".")}
            onDelete={fixedLength ? undefined : () => onDelete(idx)}
            editable={type !== "blank"}
            drag={drag?.(idx)}
            onZoom={() => focus.setFocus(innerPath)}
            onNavigate={() => scrollToMarker(innerPath)}
          >
            {component}
          </ListItem>
        )
      })}
    </div>
  )
}

const noop = () => {}
const ListItem: FC<
  PropsWithChildren<{
    idx: number
    path: string
    editable?: boolean
    onDelete?: () => void
    onZoom?: () => void
    onNavigate?: () => void
    drag?: DragProps
  }>
> = ({
  idx,
  children,
  path,
  editable = true,
  onDelete,
  drag,
  onZoom,
  onNavigate,
}) => {
  const [titleElement, setTitleElement] = useState<HTMLElement | null>(null)
  const [binaryStatus, setBinaryStatus] = useState<BinaryStatus>()
  const ref = useHeightObserver(drag?.onMeasure ?? noop)
  const [isDragging, setIsDragging] = useState(false)
  const isCollapsed = useStateObservable(isCollapsedRoot$(path))

  const startDrag = (evt: React.MouseEvent) => {
    if (!drag || isDragging) return

    setIsDragging(true)
    drag.onDragStart()

    const start = evt.pageY
    const mouseMoveHandler = (evt: MouseEvent) => {
      drag.onDragMove(evt.pageY - start)
    }
    const mouseUpHandler = (evt: MouseEvent) => {
      document.removeEventListener("mouseup", mouseUpHandler)
      document.removeEventListener("mousemove", mouseMoveHandler)
      drag.onDragEnd(evt.pageY - start)
      setIsDragging(false)
    }
    document.addEventListener("mousemove", mouseMoveHandler)
    document.addEventListener("mouseup", mouseUpHandler)
  }

  return (
    <div
      ref={drag ? ref : undefined}
      className={twMerge(
        "hover:bg-secondary/80 border-l border-tree-border last:border-0 last:before:block last:before:absolute last:before:border-l last:before:h-4 last:before:border-tree-border",
        drag?.rearranging && "relative",
        isDragging &&
          "none select-none z-10 bg-secondary/80 last:border-l last:before:border-0",
        !isDragging && drag?.rearranging && "transition-transform",
      )}
      style={{
        transform: drag?.translation
          ? `translateY(${drag.translation}px)`
          : undefined,
      }}
    >
      <ItemTitle
        path={path}
        icon={TypeIcons.list}
        titleRef={setTitleElement}
        onZoom={onZoom}
        onNavigate={onNavigate}
        binaryStatus={binaryStatus}
        className={isCollapsed ? "opacity-65" : ""}
        actions={
          <>
            {onDelete && (
              <button
                className={twMerge(
                  "hover:text-primary",
                  editable ? "cursor-pointer" : "opacity-50",
                )}
                disabled={!editable}
                onClick={onDelete}
              >
                <Trash2 size={15} />
              </button>
            )}
            {drag && (
              <div
                className={twMerge(
                  "hover:text-primary -ml-1",
                  editable
                    ? isDragging
                      ? "cursor-grabbing"
                      : "cursor-grab"
                    : "opacity-50",
                )}
                onMouseDown={startDrag}
              >
                <GripVertical size={15} />
              </div>
            )}
          </>
        }
      >
        {idx + 1}
      </ItemTitle>
      <div
        className={twMerge(
          "pl-6 pb-1 transition-opacity",
          isCollapsed && "opacity-65",
        )}
      >
        <ChildrenProviders
          titleElement={titleElement}
          onValueChange={setBinaryStatus}
        >
          {children}
        </ChildrenProviders>
      </div>
    </div>
  )
}

const useDrag = (
  rearrange: boolean,
  props: EditComplexCodecComponentProps<unknown[]>,
): ((idx: number) => DragProps) | undefined => {
  const itemHeights = useRef<number[]>([])
  const [translations, setTranslations] = useState<number[]>([])

  // react stuff... We don't want to keep recreating ResizeObservers on each render, so we prefer having a stable reference.
  const measureCallbacks = useRef<Array<(height: number) => void>>([])
  const onMeasure = (idx: number) =>
    (measureCallbacks.current[idx] ??= (height) =>
      (itemHeights.current[idx] = height))

  if (!rearrange) {
    return undefined
  }
  if (props.value === NOTIN) {
    // The component might give us "NOTIN" temporarily while it's initializing.
    // if we return undefined, then we will miss the "onMeasure" callback of when
    // each item is initialized, so we just return the function to capture measurements
    return (idx: number) => ({
      onDragEnd() {},
      onDragMove() {},
      onDragStart() {},
      onMeasure: onMeasure(idx),
      translation: translations[idx] ?? 0,
      rearranging: translations.some((t) => t !== 0),
    })
  }
  if (props.value.length <= 1) return undefined

  const getHeightSums = () =>
    itemHeights.current.reduce(
      (acc: number[], height, idx) => [...acc, (acc[idx - 1] ?? 0) + height],
      [],
    )

  const getNewIdx = (idx: number, yOffset: number) => {
    const heights = itemHeights.current
    const heightSums = getHeightSums()

    // What feels most natural is for the element to switch when the top edge
    // reaches the mid of the previous one, and the bottom edge reaches the
    // mid of the second one
    const relevantEdge = heightSums[yOffset >= 0 ? idx : idx - 1] ?? 0
    const mids = props.value.map(
      (_, idx) => (heightSums[idx - 1] ?? 0) + heights[idx] / 2,
    )

    const movedEdge = relevantEdge + yOffset
    const _biggerIdx = mids.findIndex((sum) => sum >= movedEdge)
    const biggerIdx = _biggerIdx < 0 ? props.value.length : _biggerIdx

    return yOffset >= 0 ? biggerIdx - 1 : biggerIdx
  }

  return (idx: number) => ({
    onDragEnd(yOffset) {
      const newIdx = getNewIdx(idx, yOffset)
      if (newIdx !== idx) {
        const newValue = [...props.value]
        const [element] = newValue.splice(idx, 1)
        newValue.splice(newIdx, 0, element)
        const result = newValue.filter((v) => v !== null)

        props.onValueChanged(result)
      }
      setTranslations(props.value.map(() => 0))
    },
    onDragMove(yOffset) {
      const newIdx = getNewIdx(idx, yOffset)
      const currentHeight = itemHeights.current[idx]

      const translations = props.value.map((_, otherIdx) => {
        if (otherIdx === idx) {
          const heightSums = getHeightSums()

          return Math.min(
            Math.max(-(heightSums[idx - 1] ?? 0), yOffset),
            heightSums[heightSums.length - 1] - heightSums[idx],
          )
        }
        if (otherIdx < idx) {
          return otherIdx < newIdx ? 0 : currentHeight
        }
        return otherIdx > newIdx ? 0 : -currentHeight
      })
      setTranslations(translations)
    },
    onDragStart() {},
    onMeasure: onMeasure(idx),
    translation: translations[idx] ?? 0,
    rearranging: translations.some((t) => t !== 0),
  })
}
