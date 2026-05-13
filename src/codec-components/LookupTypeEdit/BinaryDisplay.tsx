import { BinaryViewCodec } from "@/codec-components/BinaryViewCodec"
import { CopyText } from "@/components/Copy"
import { ExpandBtn } from "@/components/Expand"
import { CodecComponentType, NOTIN } from "@polkadot-api/react-builder"
import { Binary, HexString } from "@polkadot-api/substrate-bindings"
import { ComponentProps, FC, useMemo, useState } from "react"
import { twMerge } from "tailwind-merge"
import { EditCodec } from "../EditCodec"
import "./binaryDisplay.css"

type BinaryCodec = {
  enc: (value: any | NOTIN) => Uint8Array
  dec: (value: Uint8Array | HexString) => any | NOTIN
}
const toHex = (value: Uint8Array | HexString) =>
  typeof value === "string" ? value : Binary.toHex(value)

export const BinaryDisplay: FC<
  ComponentProps<typeof EditCodec> & {
    codec: BinaryCodec
    className?: string
  }
> = ({ codecType, metadata, value, onUpdate, codec, className }) => {
  const [wrap, setWrap] = useState(false)
  const [draftInputValue, setDraftInputValue] = useState<string | null>(null)

  const { hex, isEmpty, updatedInputValue } = useMemo(() => {
    const encoded = (() => {
      if (value.type === CodecComponentType.Initial) {
        return value.value ?? null
      }
      if (value.value.empty || !value.value.encoded) return null
      return value.value.encoded
    })()

    const updatedInputValue =
      value.type === CodecComponentType.Initial
        ? value.value
          ? toHex(value.value)
          : ""
        : value.value.empty
          ? ""
          : value.value.encoded
            ? toHex(value.value.encoded)
            : null

    return {
      hex: encoded ? toHex(encoded) : null,
      isEmpty:
        (value.type === CodecComponentType.Initial && !value.value) ||
        (value.type === CodecComponentType.Updated && value.value.empty),
      updatedInputValue,
    }
  }, [value])

  const inputValue = draftInputValue ?? updatedInputValue ?? ""
  const { validity } = useMemo(
    () => validateInputValue(inputValue, codec),
    [codec, inputValue],
  )

  return (
    <div className={twMerge("px-2 w-full", className)}>
      <div className="px-3 py-2 gap-2 flex flex-row border-border border items-start">
        <CopyText text={hex ?? ""} disabled={!hex} className="h-5" />
        <div className="text-sm tabular-nums overflow-hidden flex-1 group relative">
          <input
            className={twMerge(
              "w-full opacity-0 focus:opacity-100 absolute left-0 top-0",
              validity === "invalid" && "outline-red-600",
              validity === "partial" && "outline-orange-400",
            )}
            value={inputValue}
            aria-invalid={validity === "invalid" ? true : undefined}
            autoCapitalize="none"
            spellCheck={false}
            onKeyDown={(evt) => {
              const value = evt.currentTarget.value
              if (evt.key === "Escape") {
                setDraftInputValue(null)
              } else if (evt.key === "Enter") {
                if (value.trim() === "") {
                  onUpdate?.({
                    empty: true,
                  })
                } else {
                  const validation = validateInputValue(value, codec)
                  if (
                    validation.validity === "identic" ||
                    validation.validity === "partial"
                  ) {
                    onUpdate?.({
                      empty: false,
                      decoded: validation.decoded,
                      encoded: validation.encoded,
                    })
                  }
                }
                setDraftInputValue(null)
              }
            }}
            onChange={(evt) => {
              const value = evt.target.value
              const validation = validateInputValue(value, codec)
              if (validation.validity === "identic") {
                onUpdate?.({
                  empty: false,
                  decoded: validation.decoded,
                  encoded: validation.encoded,
                })
              }
              setDraftInputValue(value)
            }}
            onBlur={() => setDraftInputValue(null)}
          />
          <div
            className={twMerge(
              "binary-display-codec",
              "overflow-hidden group-focus-within:invisible",
              wrap ? "wrap-break-word" : "whitespace-nowrap text-ellipsis h-5",
            )}
          >
            {isEmpty ? (
              <div className="flex flex-row items-center gap-1 text-slate-400">
                Start by filling out the value, or enter a binary clicking here
              </div>
            ) : (
              <>
                0x
                <BinaryViewCodec
                  codecType={codecType}
                  metadata={metadata}
                  value={value}
                />
              </>
            )}
          </div>
        </div>
        <div className="flex gap-2 items-center h-5">
          <button
            type="button"
            disabled={isEmpty}
            className="flex h-5 items-center justify-center cursor-pointer disabled:cursor-default disabled:opacity-50"
            onClick={() => setWrap((v) => !v)}
          >
            <ExpandBtn
              expanded={wrap}
              direction="vertical"
              aria-hidden="true"
              className="pointer-events-none"
            />
          </button>
        </div>
      </div>
    </div>
  )
}

const validateInputValue = (
  value: string,
  codec: BinaryCodec,
):
  | { validity: "invalid" | "empty" }
  | {
      validity: "partial" | "identic"
      decoded: any
      encoded: Uint8Array
    } => {
  value = value.trim()
  if (value.length < 4) return { validity: "empty" }
  try {
    const decoded = codec.dec(value)
    const encoded = codec.enc(decoded)
    return {
      validity: toHex(encoded) === value ? "identic" : "partial",
      decoded,
      encoded,
    }
  } catch {
    return { validity: "invalid" }
  }
}
