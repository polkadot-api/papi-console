import { bytesToString } from "@/components/BinaryInput"
import { ViewBytes } from "@polkadot-api/react-builder"
import { useReportBinary } from "./CopyBinary"

export const CBytes: ViewBytes = ({ value, encodedValue }) => {
  useReportBinary(encodedValue)

  return (
    <div className="min-w-80 border-none p-0 outline-hidden bg-transparent flex-1 overflow-hidden text-ellipsis">
      {bytesToString(value)}
    </div>
  )
}
