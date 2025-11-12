import { Dot } from "lucide-react"
import React, { FC, PropsWithChildren, useContext, useState } from "react"
import { twMerge } from "tailwind-merge"
import { ChildProvider, TitleContext } from "./TitleContext"
import { ViewValue } from "./ViewValue"
import { ExpandBtn } from "@/components/Expand"

const isComplexNested = (value: unknown) => {
  if (typeof value !== "object" || !value) return false
  if (Array.isArray(value)) return value.length > 1

  if (Object.keys(value).length === 2 && "type" in value && "value" in value) {
    return isComplexNested(value.value)
  }
  return true
}

const StructItem: React.FC<
  PropsWithChildren<{
    name: string
    value: unknown
  }>
> = ({ name, value, children }) => {
  const [titleElement, setTitleElement] = useState<HTMLElement | null>(null)
  const [expanded, setExpanded] = useState(true)

  const isComplexShape = isComplexNested(value)

  return (
    <li
      className={twMerge(
        "flex flex-col transition-all duration-300",
        isComplexShape ? "cursor-pointer" : "",
      )}
      onClick={() => setExpanded((e) => !e)}
    >
      <ChildProvider titleElement={titleElement}>
        <span className="flex items-center py-1 gap-1">
          {isComplexShape ? (
            <ExpandBtn expanded={expanded} />
          ) : (
            <Dot size={16} />
          )}
          <span className="flex items-center gap-1">
            <span className="opacity-75">{name}</span>
            <span ref={setTitleElement} />
          </span>
          {isComplexShape ? null : <div>{children}</div>}
        </span>
        {isComplexShape && expanded ? <div>{children}</div> : null}
      </ChildProvider>
    </li>
  )
}

export const StructDisplay: FC<{ value: Record<string, unknown> }> = ({
  value,
}) => {
  const hasParentTitle = !!useContext(TitleContext)

  return (
    <ul
      className={twMerge(
        "flex flex-col w-full",
        hasParentTitle && "border-l border-border",
      )}
    >
      {Object.entries(value).map(([name, value]) => (
        <StructItem key={name} name={name} value={value}>
          <ViewValue value={value} />
        </StructItem>
      ))}
    </ul>
  )
}
