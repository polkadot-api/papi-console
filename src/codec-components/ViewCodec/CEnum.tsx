import { ViewEnum } from "@codec-components"
import { useStateObservable } from "@react-rxjs/core"
import { useContext, useState } from "react"
import { Portal } from "react-portal"
import { twMerge } from "tailwind-merge"
import { Marker } from "../common/Markers"
import { isActive$, setHovered } from "../common/paths.state"
import { useSubtreeFocus } from "../common/SubtreeFocus"
import { useAppendTitle } from "../EditCodec/Tree/CEnum"
import { CopyBinary, useReportBinary } from "./CopyBinary"
import { ChildProvider, TitleContext } from "./TitleContext"

export const CEnum: ViewEnum = ({ value, inner, path, encodedValue }) => {
  const focus = useSubtreeFocus()
  const titleContainer = useContext(TitleContext)
  const titleElement = useAppendTitle(titleContainer, "")
  const [newElement, setNewElement] = useState<HTMLElement | null>(null)
  const pathStr = path.join(".")
  const isActive = useStateObservable(isActive$(pathStr))
  useReportBinary(encodedValue)
  const sub = focus.getNextPath(path)
  if (sub) {
    return inner
  }

  if (titleContainer) {
    return (
      <>
        {titleElement ? (
          <Portal node={titleElement}>/ {value.type}</Portal>
        ) : null}
        {inner}
      </>
    )
  }

  return (
    <div
      className={twMerge("flex flex-col")}
      onMouseEnter={() => setHovered({ id: pathStr, hover: true })}
      onMouseLeave={() => setHovered({ id: pathStr, hover: false })}
    >
      <Marker id={[...path, value.type]} />
      <div className="flex gap-2 overflow-hidden justify-between">
        <div ref={setNewElement} className="flex gap-1 flex-wrap">
          <span>{value.type}</span>
        </div>
        {isActive && <CopyBinary value={encodedValue} visible={isActive} />}
      </div>
      <div className="flex flex-col pt-1">
        <ChildProvider titleElement={newElement}>{inner}</ChildProvider>
      </div>
    </div>
  )
}