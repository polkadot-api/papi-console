import { IntegerInput } from "@/components/IntegerInput"
import {
  EditBigNumber,
  EditBigNumberInterface,
  EditNumber,
  EditPrimitiveComponentProps,
  NOTIN,
} from "@polkadot-api/react-builder"
import { useState } from "react"
import { twMerge } from "tailwind-merge"

function NumericEdit({
  value,
  onValueChanged,
  numType,
}: EditPrimitiveComponentProps<bigint> & {
  numType:
    | "u8"
    | "u16"
    | "u32"
    | "i8"
    | "i16"
    | "i32"
    | "u64"
    | "u128"
    | "u256"
    | "i64"
    | "i128"
    | "i256"
}) {
  const getValidation = () => {
    const sign = numType.substring(0, 1)
    const size = Number(numType.substring(1))

    const maxValue = sign === "i" ? 2 ** size / 2 - 1 : 2 ** size - 1
    const minValue = sign === "i" ? -(2 ** size / 2) : 0

    if (value === NOTIN) return null
    if (value > maxValue) return "Too high. Max is " + maxValue
    if (value < minValue) return "Too low. Min is " + minValue
    return null
  }
  const [hasBlurred, blur] = useState(false)

  const warn = value === NOTIN
  const error = getValidation()

  return (
    <div className="flex gap-1 items-center">
      <IntegerInput
        className={twMerge(
          "px-4 py-2 border border-border leading-tight text-foreground rounded bg-input",
          warn ? "border-yellow-400" : null,
          error ? "border-red-500" : null,
        )}
        value={value === NOTIN ? null : value}
        placeholder={numType}
        onChange={(value) => onValueChanged(value == null ? NOTIN : value)}
        onFocus={() => blur(false)}
        onBlur={() => blur(true)}
      />
      {(hasBlurred || error) &&
        (typeof error === "string" ? (
          <span className="text-red-600 text-sm">{error}</span>
        ) : typeof warn === "string" ? (
          <span className="text-orange-400 text-sm">{warn}</span>
        ) : null)}
    </div>
  )
}

export const CBigNumber: EditBigNumber = NumericEdit

const toBigInt = (v: number | NOTIN) => (v === NOTIN ? NOTIN : BigInt(v))
const toNumber = (v: bigint | NOTIN) => (v === NOTIN ? NOTIN : Number(v))
export const CNumber: EditNumber = (props) => {
  const decode: EditBigNumberInterface["decode"] = (v) =>
    toBigInt(props.decode(v))
  const onValueChanged: EditBigNumberInterface["onValueChanged"] = (value) =>
    props.onValueChanged(toNumber(value))

  return props.type === "blank" ? (
    <NumericEdit {...props} decode={decode} onValueChanged={onValueChanged} />
  ) : (
    <NumericEdit
      {...props}
      decode={decode}
      onValueChanged={onValueChanged}
      value={BigInt(props.value)}
    />
  )
}
