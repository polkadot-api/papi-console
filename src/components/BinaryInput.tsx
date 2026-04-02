import { byteArraysAreEqual } from "@/utils/byteArray"
import { NOTIN } from "@polkadot-api/react-builder"
import { Binary } from "@polkadot-api/substrate-bindings"
import { FileUp } from "lucide-react"
import { fromHex, toHex } from "polkadot-api/utils"
import { FC, useState } from "react"
import { twMerge } from "tailwind-merge"
import { SwitchBinary } from "./Icons"
import { TextInputField } from "./TextInputField"
import { useGenericSynchronizeInput } from "./useSynchroniseInput"

export const BinaryInput: React.FC<{
  encodedValue: Uint8Array | NOTIN
  onValueChanged: (newValue: Uint8Array | NOTIN) => boolean
  len?: number
}> = ({ encodedValue, onValueChanged, len }) => {
  const [localInput, setLocalInput] = useGenericSynchronizeInput(
    encodedValue,
    onValueChanged,
    (value) => validate(parseValue(value), len),
    "" as string | Uint8Array,
    serializeValue,
    checkEqualInputBinary,
  )
  const [uploadError, setUploadError] = useState("")

  const inputValue = typeof localInput === "string" ? localInput : ""
  const placeholder =
    typeof localInput === "string"
      ? "Enter text or hex" + (len ? ` (${len.toLocaleString()} bytes)` : "")
      : "(value is too long to display)"

  const validateFile = (file: File) => {
    if (file.size > 512 * 1024 * 1024) {
      setUploadError("File size can't exceed 512MB")
      return false
    }
    if (len && file.size !== len) {
      setUploadError(
        `Field requires exactly ${len} bytes, uploaded file is ${file.size} bytes instead`,
      )
      return false
    }
    return true
  }

  const parsed = parseValue(inputValue)
  const length = parsed === NOTIN ? null : parsed.length

  const oddHexLength =
    typeof localInput === "string" &&
    localInput.startsWith("0x") &&
    localInput.length % 2 === 1

  const warn = oddHexLength
    ? "Hex length is odd"
    : len && length && length !== len
      ? `Field requires ${len} bytes, got ${length} instead.`
      : false

  return (
    <TextInputField
      value={inputValue}
      onChange={(v) => {
        setUploadError("")
        setLocalInput(v)
      }}
      placeholder={placeholder}
      className="min-w-80 border-none p-0 outline-hidden bg-transparent flex-1"
      warn={warn}
      error={uploadError}
    >
      {(input) => (
        <div
          className={twMerge(
            "px-4 py-2 border border-border rounded leading-tight focus-within:outline flex items-center gap-2 bg-input",
            warn ? "border-orange-400" : null,
            uploadError ? "border-red-600" : null,
          )}
        >
          <button
            className="align-middle mr-2 cursor-pointer text-foreground/90"
            type="button"
            onClick={() => {
              if (inputValue.startsWith("0x")) {
                setLocalInput(serializeValue(fromHex(inputValue)))
              } else {
                setLocalInput(toHex(Binary.fromText(inputValue)))
              }
            }}
            tabIndex={-1}
          >
            <SwitchBinary size={24} />
          </button>
          {input}
          <label title="Load from file" className="text-foreground/80">
            <FileUp size={16} />
            <BinaryFileInput
              validate={validateFile}
              onLoaded={(binary) => {
                setLocalInput(serializeValue(binary))
                setUploadError("")
              }}
              onError={() => setUploadError("Error while loading file")}
            />
          </label>
        </div>
      )}
    </TextInputField>
  )
}

export const BinaryFileInput: FC<{
  validate: (file: File) => boolean
  onLoaded: (value: Uint8Array) => void
  onError: () => void
}> = ({ validate, onLoaded, onError }) => {
  const loadFile = async (file: File) => {
    if (!validate(file)) {
      return
    }
    try {
      const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as ArrayBuffer)
        reader.onerror = reject
        reader.readAsArrayBuffer(file)
      })
      onLoaded(new Uint8Array(buffer))
    } catch (ex) {
      console.error(ex)
      onError()
    }
  }

  return (
    <input
      type="file"
      onChange={(e) => {
        const file = e.currentTarget.files?.[0]
        if (file) loadFile(file)
      }}
      className="hidden"
    />
  )
}

const validate = (
  value: Uint8Array | NOTIN,
  len?: number,
): Uint8Array | NOTIN => {
  if (!len || value === NOTIN) return value
  return value.length !== len ? NOTIN : value
}

const parseValue = (value: string | Uint8Array): Uint8Array | NOTIN => {
  if (value instanceof Uint8Array) return value

  if (value.trim() === "") return Binary.fromText("")

  if (value.startsWith("0x")) {
    try {
      return fromHex(value)
    } catch (_) {
      return NOTIN
    }
  }

  return Binary.fromText(value)
}

const serializeValue = (value: Uint8Array): string | Uint8Array => {
  if (value.length === 0) return ""
  if (value.length > 5 * 1024 * 1024) return value

  return bytesToString(value)
}

const textDecoder = new TextDecoder("utf-8", { fatal: true })
export const getBytesFormat = (value: Uint8Array) => {
  try {
    if (value.slice(0, 5).every((b) => b < 32)) throw null
    return {
      type: "text",
      value: textDecoder.decode(value),
    }
  } catch (_) {
    return {
      type: "hex",
      value: toHex(value),
    }
  }
}
export const bytesToString = (value: Uint8Array) => getBytesFormat(value).value

export const checkEqualInputBinary = (
  input: string | Uint8Array,
  value: Uint8Array | typeof NOTIN,
) => {
  const parsed = parseValue(input)
  if (parsed === NOTIN || value === NOTIN) return true
  return byteArraysAreEqual(parsed, value)
}
