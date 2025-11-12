import { HexString } from "polkadot-api"
import { FC } from "react"
import { ViewValue } from "./ViewValue"

export const BoolDisplay: FC<{ value: boolean }> = ({ value }) => {
  return <div className="flex gap-4">{value ? "Yes" : "No"}</div>
}

export const EthAccountDisplay: FC<{ value: HexString }> = ({ value }) => (
  <span>{value}</span>
)

export const NoneDisplay: FC = () => (
  <span className="text-foreground/60">None</span>
)

export const ResultDisplay: FC<{
  value: { success: boolean; value: unknown }
}> = ({ value }) => {
  return (
    <div>
      <div>{value.success ? "OK" : "KO"}</div>
      <ViewValue value={value.value} />
    </div>
  )
}

export const StrDisplay: FC<{ value: string }> = ({ value }) => (
  <div>{value}</div>
)
export const NumberDisplay: FC<{ value: number | bigint }> = ({ value }) => (
  <div>{String(value)}</div>
)
