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
  const formattedValue = roundToSignificantDigits(
    Number(amount) / 10 ** properties.decimals,
  )

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

export const roundToSignificantDigits = (value: number) => {
  const abs = Math.abs(value)
  const maximumFractionDigits = abs >= 100 ? 0 : abs >= 10 ? 1 : 2

  return abs >= 1
    ? value.toLocaleString(undefined, {
        maximumFractionDigits,
      })
    : value.toLocaleString(undefined, {
        maximumSignificantDigits: 3,
      })
}
