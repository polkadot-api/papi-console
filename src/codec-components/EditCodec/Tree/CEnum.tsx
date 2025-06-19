import { PathsRoot, setHovered } from "@/codec-components/common/paths.state"
import { Enum } from "@/components/Icons"
import { isComplex } from "@/utils/shape"
import { EditEnum, NOTIN } from "@polkadot-api/react-builder"
import { useContext, useLayoutEffect, useState } from "react"
import { Portal } from "react-portal"
import { scrollToMarker } from "../../common/scroll"
import { useSubtreeFocus } from "../../common/SubtreeFocus"
import {
  ChildrenProviders,
  ItemTitle,
  TitleContext,
  useReportBinaryStatus,
} from "./codec-components"

export const CEnum: EditEnum = ({
  value,
  inner,
  path,
  shape,
  type,
  encodedValue,
  onValueChanged,
  decode,
}) => {
  const pathId = useContext(PathsRoot)
  const className =
    "text-slate-500 hover:text-polkadot-500 cursor-pointer whitespace-nowrap not-first:ml-1"

  const titleContainer = useContext(TitleContext)
  const titleElement = useAppendTitle(titleContainer, className)
  useReportBinaryStatus(type, encodedValue, onValueChanged, decode)
  // We create a title element for the children below if we don't have a parent.
  const [newElement, setNewElement] = useState<HTMLElement | null>(null)
  const focus = useSubtreeFocus()
  const sub = focus.getNextPath(path)
  if (sub) {
    return inner
  }

  if (value === NOTIN) return null

  const innerPath = [...path, value.type]
  const pathStr = path.join(".")
  if (titleContainer) {
    return titleElement ? (
      <>
        <Portal node={titleElement}>
          <span
            onClick={() => scrollToMarker(innerPath)}
            onMouseEnter={() =>
              setHovered(pathId, { id: pathStr, hover: true })
            }
            onMouseLeave={() =>
              setHovered(pathId, { id: pathStr, hover: false })
            }
          >
            / {value.type}
          </span>
        </Portal>
        {/* It's important not to show the inner elements until this one isn't
        ready, because elements must be appended in order.
        Bug was: Utility.Batch(System.remark(whatever)) then refresh page. The
        enum for the inner call would show up reversed (/remark/System)
        Be careful, in strict mode (dev) this bug doesn't show up. */}
        <ChildrenProviders
          titleElement={titleContainer ?? newElement}
          onValueChange={() => {}}
        >
          {inner}
        </ChildrenProviders>
      </>
    ) : null
  }

  const innerShape = shape.value[value.type]
  const innerEntry =
    innerShape.type === "lookupEntry" ? innerShape.value : innerShape
  const innerIsComplex = isComplex(innerEntry.type)
  return (
    <div className="before:absolute before:border-l before:h-4 before:border-tree-border">
      <ItemTitle
        icon={Enum}
        path={path.join(".")}
        titleRef={setNewElement}
        onNavigate={() => scrollToMarker(path)}
        onZoom={innerIsComplex ? () => focus.setFocus(innerPath) : undefined}
        binaryStatus={{
          encodedValue,
          onValueChanged,
          decode,
          type,
        }}
      >
        {value.type}
      </ItemTitle>
      <ChildrenProviders
        titleElement={titleContainer ?? newElement}
        onValueChange={() => {}}
      >
        <div className="pl-6">{inner}</div>
      </ChildrenProviders>
    </div>
  )
}

export const useAppendTitle = (
  container: HTMLElement | null,
  className: string,
) => {
  const [element, setElement] = useState<HTMLElement | null>(null)

  useLayoutEffect(() => {
    if (!container) return

    const element = document.createElement("span")
    container.appendChild(element)
    setElement(element)

    return () => element.remove()
  }, [container])
  useLayoutEffect(() => {
    if (!element) return
    element.className = className ?? ""
  }, [element, className])

  return element
}
