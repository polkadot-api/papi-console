import { Dot } from "lucide-react"
import React, { FC, PropsWithChildren, useContext, useState } from "react"
import { twMerge } from "tailwind-merge"
import { ChildProvider, TitleContext } from "./TitleContext"
import { ViewValue } from "./ViewValue"

const StructItem: React.FC<
  PropsWithChildren<{
    name: string
  }>
> = ({ name, children }) => {
  const [titleElement, setTitleElement] = useState<HTMLElement | null>(null)

  return (
    <li className={twMerge("flex flex-col transition-all duration-300")}>
      <ChildProvider titleElement={titleElement}>
        <span className="flex items-center py-1 gap-1">
          <Dot size={16} />
          <span className="flex items-center gap-1">
            <span className="opacity-75">{name}</span>
            <span ref={setTitleElement} />
          </span>
          <div>{children}</div>
        </span>
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
        <StructItem key={name} name={name}>
          <ViewValue value={value} />
        </StructItem>
      ))}
    </ul>
  )
}
