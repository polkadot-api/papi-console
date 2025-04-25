import { ExpandBtn } from "@/components/Expand"
import { ViewStruct } from "@polkadot-api/react-builder"
import { Var } from "@polkadot-api/metadata-builders"
import { useStateObservable } from "@react-rxjs/core"
import React, { useContext, useState } from "react"
import { twMerge } from "tailwind-merge"
import { Marker } from "../common/Markers"
import {
  isActive$,
  isCollapsed$,
  PathsRoot,
  setHovered,
  toggleCollapsed,
} from "../common/paths.state"
import { useSubtreeFocus } from "../common/SubtreeFocus"
import { ItemMarker } from "../EditCodec/Tree/codec-components"
import { CopyChildBinary, useReportBinary } from "./CopyBinary"
import { ChildProvider, TitleContext } from "./TitleContext"
import { isComplexNested } from "./utils"
import { Dot } from "lucide-react"

const StructItem: React.FC<{
  name: string
  children: React.ReactNode
  path: string[]
  field: Var
  value: unknown
}> = ({ name, children, path, field, value }) => {
  const pathsRootId = useContext(PathsRoot)
  const pathStr = path.join(".")
  const isActive = useStateObservable(isActive$(pathStr))
  const isExpanded = !useStateObservable(isCollapsed$(pathStr))
  const hasParentTitle = !!useContext(TitleContext)
  const [titleElement, setTitleElement] = useState<HTMLElement | null>(null)

  const isComplexShape = isComplexNested(field, value)

  const title = isComplexShape ? (
    <span
      onClick={() => toggleCollapsed(pathsRootId, pathStr)}
      className="cursor-pointer flex items-center py-1 gap-1"
    >
      {hasParentTitle && <ItemMarker />}
      <ExpandBtn expanded={isExpanded} />
      <span className="flex items-center gap-1" ref={setTitleElement}>
        <span className="opacity-75">{name}</span>
      </span>
      <div className="flex-1 text-right">
        <CopyChildBinary visible={isActive} />
      </div>
    </span>
  ) : (
    <span className="flex items-center py-1 gap-1">
      {hasParentTitle && <ItemMarker />}
      <Dot size={16} />
      <span className="flex items-center gap-1">
        <span className="opacity-75">{name}</span>
        <span ref={setTitleElement} />
      </span>
      <div>{children}</div>
      <div className="flex-1 text-right">
        <CopyChildBinary visible={isActive} />
      </div>
    </span>
  )

  return (
    <li
      className={twMerge(
        "flex flex-col transition-all duration-300",
        isActive && "bg-secondary/80",
      )}
      onMouseEnter={() => setHovered(pathsRootId, { id: pathStr, hover: true })}
      onMouseLeave={() =>
        setHovered(pathsRootId, { id: pathStr, hover: false })
      }
    >
      <ChildProvider titleElement={titleElement}>
        <Marker id={path} />
        {title}
        {isComplexShape && (
          <div
            className={twMerge(
              "flex flex-row pb-2",
              hasParentTitle ? "pl-4" : "pl-2",
              isExpanded ? "" : "hidden",
            )}
          >
            {children}
          </div>
        )}
      </ChildProvider>
    </li>
  )
}

export const CStruct: ViewStruct = ({
  innerComponents,
  path,
  shape,
  encodedValue,
  value,
}) => {
  useReportBinary(encodedValue)
  const focus = useSubtreeFocus()
  const hasParentTitle = !!useContext(TitleContext)
  const sub = focus.getNextPath(path)
  if (sub) {
    const field = Object.entries(innerComponents).find(([key]) => key === sub)
    return field?.[1]
  }

  return (
    <ul
      className={twMerge(
        "flex flex-col w-full",
        hasParentTitle && "border-l border-tree-border",
      )}
    >
      {Object.entries(innerComponents).map(([name, jsx]) => (
        <StructItem
          name={name}
          key={name}
          path={[...path, name]}
          field={shape.value[name]}
          value={value[name]}
        >
          {jsx}
        </StructItem>
      ))}
    </ul>
  )
}
