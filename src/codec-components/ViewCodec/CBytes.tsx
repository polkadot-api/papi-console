import { getBytesFormat } from "@/components/BinaryInput"
import { ViewBytes } from "@polkadot-api/react-builder"
import { useReportBinary } from "./CopyBinary"
import { SwitchBinary } from "@/components/Icons"
import { useState } from "react"

export const CBytes: ViewBytes = ({ value, encodedValue }) => {
  const [forceBinary, setForceBinary] = useState(false)

  useReportBinary(encodedValue)
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
      {forceBinary ? value.asHex() : format.value}
    </div>
  )
}
