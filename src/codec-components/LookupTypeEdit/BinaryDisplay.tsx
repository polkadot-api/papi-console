import { BinaryViewCodec } from "@/codec-components/BinaryViewCodec"
import { BinaryEditButton } from "@/components/BinaryEditButton"
import { CopyText } from "@/components/Copy"
import { ExpandBtn } from "@/components/Expand"
import { CodecComponentType, NOTIN } from "@polkadot-api/react-builder"
import { Binary, HexString } from "@polkadot-api/substrate-bindings"
import { toHex } from "@polkadot-api/utils"
import { ComponentProps, FC, useState } from "react"
import { twMerge } from "tailwind-merge"
import { EditCodec } from "../EditCodec"
import "./binaryDisplay.css"

export const BinaryDisplay: FC<
  ComponentProps<typeof EditCodec> & {
    codec: {
      enc: (value: any | NOTIN) => Uint8Array
      dec: (value: Uint8Array | HexString) => any | NOTIN
    }
    className?: string
  }
> = ({ codecType, metadata, value, onUpdate, codec, className }) => {
  const [wrap, setWrap] = useState(false)
  const encoded = (() => {
    if (value.type === CodecComponentType.Initial) {
      if (!value.value) return null
      return typeof value.value === "string"
        ? Binary.fromHex(value.value).asBytes()
        : value.value
    }
    if (value.value.empty || !value.value.encoded) return null
    return value.value.encoded
  })()
  const hex = encoded ? toHex(encoded) : null
  const isEmpty =
    (value.type === CodecComponentType.Initial && !value.value) ||
    (value.type === CodecComponentType.Updated && value.value.empty)

  return (
    <div className={twMerge("px-2 w-full", className)}>
      <div className="px-3 py-2 gap-2 flex flex-row border-border border items-start">
        <CopyText text={hex ?? ""} disabled={!hex} className="h-5" />
        <div
          className={twMerge(
            "binary-display-codec",
            "text-sm tabular-nums overflow-hidden flex-1",
            wrap ? "break-words" : "whitespace-nowrap text-ellipsis h-5",
          )}
        >
          {isEmpty ? (
            <div className="flex flex-row items-center gap-1 text-slate-400">
              Start by filling out the value, or enter a binary using the edit
              binary button at the end of this line.
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
        <div className="flex gap-2 items-center h-5">
          <ExpandBtn
            expanded={wrap}
            direction="vertical"
            className={twMerge(
              "cursor-pointer",
              isEmpty && "opacity-50 pointer-events-none",
            )}
            onClick={() => setWrap((v) => !v)}
          />
          <BinaryEditButton
            initialValue={encoded ?? undefined}
            onValueChange={(decoded) => {
              const encoded = codec.enc(decoded)
              onUpdate?.({ empty: false, decoded, encoded })
              return true
            }}
            decode={codec.dec}
            iconProps={{
              size: 24,
            }}
          />
        </div>
      </div>
    </div>
  )
}
