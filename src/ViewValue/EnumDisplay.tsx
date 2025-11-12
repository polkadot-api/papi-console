import { useAppendTitle } from "@/codec-components/EditCodec/Tree/CEnum"
import { Enum } from "polkadot-api"
import { FC, useContext, useState } from "react"
import { Portal } from "react-portal"
import { twMerge } from "tailwind-merge"
import { ChildProvider, TitleContext } from "./TitleContext"
import { ViewValue } from "./ViewValue"

export const EnumDisplay: FC<{
  value: Enum<Record<string, unknown>>
}> = ({ value }) => {
  const titleContainer = useContext(TitleContext)
  const titleElement = useAppendTitle(titleContainer, "")
  const [newElement, setNewElement] = useState<HTMLElement | null>(null)

  const inner = <ViewValue value={value.value} />

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
    <div className={twMerge("flex flex-col")}>
      <div className="flex gap-2 overflow-hidden justify-between">
        <div ref={setNewElement} className="flex gap-1 flex-wrap">
          <span>{value.type}</span>
        </div>
      </div>
      <div className="flex flex-col pt-1">
        <ChildProvider titleElement={newElement}>{inner}</ChildProvider>
      </div>
    </div>
  )
}
