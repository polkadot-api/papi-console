import { getBytesFormat } from "@/components/BinaryInput"
import { SwitchBinary } from "@/components/Icons"
import { ViewBytes } from "@polkadot-api/react-builder"
import { FC, useState } from "react"
import { useReportBinary } from "./CopyBinary"
import { toHex } from "polkadot-api/utils"

export const CBytes: ViewBytes = ({ value, encodedValue }) => {
  useReportBinary(encodedValue)

  return <BytesDisplay value={value} />
}

export const BytesDisplay: FC<{ value: Uint8Array }> = ({ value }) => {
  const [forceBinary, setForceBinary] = useState(false)

  const format = getBytesFormat(value)

  return (
    <div className="min-w-80 border-none p-0 outline-hidden bg-transparent flex-1 overflow-hidden text-ellipsis">
      {format.type === "text" ? (
        <button
          className="align-middle mr-2 cursor-pointer text-foreground/90"
          type="button"
          onClick={() => setForceBinary((b) => !b)}
        >
          <SwitchBinary size={24} />
        </button>
      ) : null}
      {forceBinary ? toHex(value) : format.value}
    </div>
  )
}
