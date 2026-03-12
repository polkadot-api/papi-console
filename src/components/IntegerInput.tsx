import { useState, useCallback, useEffect, useRef, FC } from "react"

function formatWithSeparators(num: bigint): string {
  const str = num.toString()
  const isNegative = str.startsWith("-")
  const digits = isNegative ? str.slice(1) : str
  const formatted = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  return isNegative ? "-" + formatted : formatted
}

function parseBigInt(str: string): bigint | null {
  const cleaned = str.replace(/,/g, "")
  if (cleaned === "" || cleaned === "-") return null
  try {
    return BigInt(cleaned)
  } catch {
    return null
  }
}

export const IntegerInput: FC<{
  value?: bigint | null
  defaultValue?: bigint
  onChange?: (value: bigint | null) => void
  className?: string
  placeholder?: string
  onFocus?: () => void
  onBlur?: () => void
}> = ({
  value: controlledValue,
  defaultValue,
  onChange,
  onFocus,
  onBlur,
  ...props
}) => {
  const isControlled = controlledValue !== undefined
  const [internalValue, setInternalValue] = useState<bigint | null>(
    defaultValue ?? null,
  )
  const [isFocused, setIsFocused] = useState(false)
  const [rawText, setRawText] = useState<string>("")

  const currentValue = isControlled ? controlledValue : internalValue

  // Sync rawText when controlled value changes externally while not focused
  const prevControlledValue = useRef(controlledValue)
  useEffect(() => {
    if (
      isControlled &&
      !isFocused &&
      controlledValue !== prevControlledValue.current
    ) {
      // Value changed externally, no need to update rawText since we show formatted when not focused
    }
    prevControlledValue.current = controlledValue
  }, [controlledValue, isControlled, isFocused])

  const handleFocus = () => {
    setIsFocused(true)
    // When focusing, show raw digits (no separators)
    setRawText(currentValue !== null ? currentValue.toString() : "")
    onFocus?.()
  }

  const handleBlur = () => {
    setIsFocused(false)
    // Clean up rawText - parse and re-stringify to normalize
    const parsed = parseBigInt(rawText)
    if (parsed !== null) {
      setRawText(parsed.toString())
    }
    onBlur?.()
  }

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target.value

      // Allow empty input
      if (input === "") {
        setRawText("")
        if (!isControlled) setInternalValue(null)
        onChange?.(null)
        return
      }

      // Allow just a minus sign (typing in progress)
      if (input === "-") {
        setRawText("-")
        if (!isControlled) setInternalValue(null)
        onChange?.(null)
        return
      }

      // Only allow digits with optional leading minus
      if (!/^-?\d+$/.test(input)) {
        return // reject invalid input
      }

      setRawText(input)

      const parsed = parseBigInt(input)
      if (!isControlled) setInternalValue(parsed)
      onChange?.(parsed)
    },
    [isControlled, onChange],
  )

  // Determine display value
  const displayValue = isFocused
    ? rawText
    : currentValue !== null
      ? formatWithSeparators(currentValue)
      : ""

  return (
    <input
      type="text"
      inputMode="numeric"
      value={displayValue}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onChange={handleChange}
      {...props}
    />
  )
}
