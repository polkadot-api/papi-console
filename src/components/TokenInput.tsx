import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ChangeEvent, FC, useEffect, useRef, useState } from "react"

type TokenUnit = "token" | "planck"

export const TokenInput: FC<{
  value: bigint | null
  onValueChange: (value: bigint | null) => void
  token?: {
    decimals: number
    symbol?: string
  }
}> = ({ value, onValueChange, token }) => {
  const [unit, setUnit] = useState<TokenUnit>(() =>
    token ? "token" : "planck",
  )
  const userSelectedUnit = useRef(false)
  const [isFocused, setIsFocused] = useState(false)
  const [rawText, setRawText] = useState("")

  useEffect(() => {
    const nextUnit =
      !token && unit === "token"
        ? "planck"
        : token && !userSelectedUnit.current && unit === "planck"
          ? "token"
          : unit

    if (nextUnit === unit) return

    setUnit(nextUnit)
    if (isFocused) {
      setRawText(
        value == null ? "" : formatValue(value, nextUnit, token, false),
      )
    }
  }, [token, unit, isFocused, value])

  const displayValue = isFocused
    ? rawText
    : value == null
      ? ""
      : formatValue(value, unit, token, true)

  const handleUnitChange = (nextUnit: TokenUnit) => {
    if (nextUnit === "token" && !token) return

    userSelectedUnit.current = true
    setUnit(nextUnit)
    setRawText(value == null ? "" : formatValue(value, nextUnit, token, false))
  }

  const handleFocus = () => {
    setIsFocused(true)
    setRawText(value == null ? "" : formatValue(value, unit, token, false))
  }

  const handleBlur = () => {
    setIsFocused(false)
  }

  const handleChange = (evt: ChangeEvent<HTMLInputElement>) => {
    const input = evt.target.value

    if (unit === "token" && token) {
      const parsed = parseTokenInput(input, token.decimals)
      if (!parsed.accepted) return

      setRawText(parsed.text)
      onValueChange(parsed.value)
      return
    }

    const parsed = parsePlanckInput(input)
    if (!parsed.accepted) return

    setRawText(parsed.text)
    onValueChange(parsed.value)
  }

  return (
    <div className="flex min-w-0 items-center rounded-md focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
      <input
        type="text"
        inputMode={unit === "token" && token?.decimals ? "decimal" : "numeric"}
        value={displayValue}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onChange={handleChange}
        className="h-10 min-w-0 flex-1 rounded-l-md rounded-r-none border border-border border-r-0 bg-background px-3 py-2 font-mono text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
      />
      <Select
        value={unit}
        onValueChange={(value) => handleUnitChange(value as TokenUnit)}
        disabled={!token}
      >
        <SelectTrigger className="h-10 w-24 shrink-0 rounded-l-none bg-background text-xs font-medium focus:ring-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {token ? (
            <SelectItem value="token">{token.symbol ?? "Token"}</SelectItem>
          ) : null}
          <SelectItem value="planck">Planck</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}

const parsePlanckInput = (
  value: string,
): {
  accepted: boolean
  text: string
  value: bigint | null
} => {
  const text = value.replace(/[,. ']/g, "")

  if (text === "" || text === "-") {
    return { accepted: true, text, value: null }
  }

  if (!/^-?\d+$/.test(text)) {
    return { accepted: false, text, value: null }
  }

  return { accepted: true, text, value: BigInt(text) }
}

const parseTokenInput = (
  value: string,
  decimals: number,
): {
  accepted: boolean
  text: string
  value: bigint | null
} => {
  const tokenDecimals = normalizeDecimals(decimals)
  const text = value.replace(/[, ']/g, "")

  if (text === "" || text === "-" || text === "." || text === "-.") {
    return { accepted: true, text, value: null }
  }

  if (!/^-?(?:\d+|\d*\.\d*)$/.test(text)) {
    return { accepted: false, text, value: null }
  }

  const isNegative = text.startsWith("-")
  const unsigned = isNegative ? text.slice(1) : text
  const [whole = "0", fractional = ""] = unsigned.split(".")

  if (fractional.length > tokenDecimals) {
    return { accepted: false, text, value: null }
  }

  const scale = getScale(tokenDecimals)
  const wholePlancks = BigInt(whole || "0") * scale
  const fractionalPlancks =
    fractional.length > 0 ? BigInt(fractional.padEnd(tokenDecimals, "0")) : 0n
  const plancks = wholePlancks + fractionalPlancks

  return {
    accepted: true,
    text,
    value: isNegative ? -plancks : plancks,
  }
}

const formatValue = (
  value: bigint,
  unit: TokenUnit,
  token: { decimals: number; symbol?: string } | undefined,
  withSeparators: boolean,
) => {
  if (unit === "token" && token) {
    return formatTokenInputValue(value, token.decimals, withSeparators)
  }

  return withSeparators ? formatIntegerWithSeparators(value) : value.toString()
}

const formatTokenInputValue = (
  value: bigint,
  decimals: number,
  withSeparators: boolean,
) => {
  const tokenDecimals = normalizeDecimals(decimals)
  const isNegative = value < 0n
  const absolute = isNegative ? -value : value
  const scale = getScale(tokenDecimals)
  const whole = absolute / scale
  const fractional = absolute % scale
  const wholeText = withSeparators
    ? formatIntegerWithSeparators(whole)
    : whole.toString()
  const fractionalText = tokenDecimals
    ? fractional.toString().padStart(tokenDecimals, "0").replace(/0+$/, "")
    : ""

  return `${isNegative ? "-" : ""}${wholeText}${
    fractionalText ? `.${fractionalText}` : ""
  }`
}

const formatIntegerWithSeparators = (value: bigint) => {
  const text = value.toString()
  const isNegative = text.startsWith("-")
  const digits = isNegative ? text.slice(1) : text
  const formatted = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",")

  return isNegative ? `-${formatted}` : formatted
}

const normalizeDecimals = (decimals: number) =>
  Number.isFinite(decimals) ? Math.max(0, Math.trunc(decimals)) : 0

const getScale = (decimals: number) =>
  10n ** BigInt(normalizeDecimals(decimals))
