import { lookupToType, TypeIcon, TypeIcons } from "@/components/Icons"
import { isComplex } from "@/utils/shape"
import { EditStruct } from "@polkadot-api/react-builder"
import { useStateObservable } from "@react-rxjs/core"
import { FC, PropsWithChildren, useState } from "react"
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

const StructField: FC<
  PropsWithChildren<{
    label: string
    path: string
    icon: (typeof TypeIcons)[TypeIcon]
    onZoom?: () => void
    onNavigate?: () => void
  }>
> = ({ label, children, onZoom, onNavigate, path, icon: Icon }) => {
  const [titleElement, setTitleElement] = useState<HTMLElement | null>(null)
  const [binaryStatus, setBinaryStatus] = useState<BinaryStatus>()
  const isCollapsed = useStateObservable(isCollapsedRoot$(path))

  return (
    <div className="flex flex-col text-left border-l border-tree-border last:border-0 last:before:block last:before:absolute last:before:border-l last:before:h-4 last:before:border-tree-border">
      <ItemTitle
        icon={Icon}
        path={path}
        onNavigate={onNavigate}
        titleRef={setTitleElement}
        onZoom={onZoom}
        binaryStatus={binaryStatus}
        className={isCollapsed ? "opacity-65" : ""}
      >
        {label}
      </ItemTitle>
      <div
        className={twMerge(
          "pl-6 transition-opacity",
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

export const CStruct: EditStruct = ({
  innerComponents,
  shape,
  path,
  type,
  encodedValue,
  onValueChanged,
  decode,
}) => {
  const focus = useSubtreeFocus()
  useReportBinaryStatus(type, encodedValue, onValueChanged, decode)

  const sub = focus.getNextPath(path)
  if (sub) {
    const field = Object.entries(innerComponents).find(([key]) => key === sub)
    return field?.[1]
  }

  return (
    <div className="flex flex-col text-left">
      {Object.entries(innerComponents).map(([key, jsx]) => {
        const innerShape = shape.value[key]
        const isComplexShape = isComplex(innerShape.type)
        const innerPath = [...path, key]

        return (
          <StructField
            key={key}
            label={key}
            onZoom={
              isComplexShape || innerShape.type === "option"
                ? () => focus.setFocus(innerPath)
                : undefined
            }
            onNavigate={() => scrollToMarker(innerPath)}
            path={innerPath.join(".")}
            icon={
              isComplexShape
                ? TypeIcons.object
                : TypeIcons[lookupToType[innerShape.type]]
            }
          >
            {jsx}
          </StructField>
        )
      })}
    </div>
  )
}
