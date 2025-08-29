import { cn } from "@/lib/utils"
import { chainProperties$ } from "@/state/chain-props.state"
import { useStateObservable } from "@react-rxjs/core"
import { FC } from "react"

export const TokenAmount: FC<{
  children: bigint
  className?: string
}> = ({ children, className }) => {
  const properties = useStateObservable(chainProperties$)

  if (!properties) return null

  if (properties?.tokenDecimals == null) {
    return children.toLocaleString()
  }

  const formattedValue = (
    Number(children) /
    10 ** properties.tokenDecimals
  ).toLocaleString(undefined)

  return (
    <span
      className={cn("tabular-nums", className)}
    >{`${formattedValue} ${properties.tokenSymbol}`}</span>
  )
}
