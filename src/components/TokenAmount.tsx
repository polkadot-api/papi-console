import { cn } from "@/lib/utils"
import { chainProperties$ } from "@/state/chain-props.state"
import { useStateObservable } from "@react-rxjs/core"
import { FC } from "react"

export const formatToken = (
  amount: bigint,
  properties: {
    decimals: number
    symbol?: string
  },
) => {
  const formattedValue = (
    Number(amount) /
    10 ** properties.decimals
  ).toLocaleString(undefined, {
    maximumSignificantDigits: 3,
  })

  return `${formattedValue} ${properties.symbol}`
}

export const TokenAmount: FC<{
  children: bigint
  className?: string
}> = ({ children, className }) => {
  const properties = useStateObservable(chainProperties$)

  if (!properties) return null

  if (properties?.tokenDecimals == null) {
    return children.toLocaleString()
  }

  return (
    <span className={cn("tabular-nums", className)}>
      {formatToken(children, {
        decimals: properties.tokenDecimals,
        symbol: properties.tokenSymbol,
      })}
    </span>
  )
}
