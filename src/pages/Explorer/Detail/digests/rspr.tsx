import { compactNumber, Hex, Struct } from "@polkadot-api/substrate-bindings"
import { HexString } from "polkadot-api"
import { createDecodeDigestFn, FieldGrid, HexDisplay } from "./components"

export const rsprConsensus = (payload: HexString) => {
  const decoded = decodeRsprConsensus(payload)
  return decoded
    ? {
        summary: {
          label: "Relay block",
          value: decoded.blockNumber.toString(),
        },
        details: (
          <FieldGrid
            fields={[
              {
                label: "Storage root",
                value: <HexDisplay value={decoded.storageRoot} />,
              },
            ]}
          />
        ),
      }
    : null
}

const RsprConsensusLog = Struct({
  storageRoot: Hex(32),
  blockNumber: compactNumber,
})
const decodeRsprConsensus = createDecodeDigestFn(RsprConsensusLog)
