import { Struct, u64 } from "@polkadot-api/substrate-bindings"
import { HexString } from "polkadot-api"
import { createDecodeDigestFn } from "./components"

export const istmConsensus = (payload: HexString) => {
  const decoded = decodeIsmpTimestampConsensus(payload)
  return decoded
    ? {
        summary: {
          label: "Timestamp",
          value: new Date(Number(decoded.timestamp) * 1000).toISOString(),
        },
        details: [],
      }
    : null
}

const IsmpTimestampDigest = Struct({
  timestamp: u64,
})
const decodeIsmpTimestampConsensus = createDecodeDigestFn(IsmpTimestampDigest)
