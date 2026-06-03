import { Hex, Struct } from "@polkadot-api/substrate-bindings"
import { HexString } from "polkadot-api"
import { createDecodeDigestFn, FieldGrid, HexDisplay } from "./components"

export const randPreDigest = (payload: HexString) => {
  const decoded = decodeRandVrfConsensus(payload)
  return decoded
    ? {
        summary: {
          label: "VRF output",
          value: <HexDisplay value={decoded.vrf_output} />,
        },
        details: (
          <FieldGrid
            fields={[
              {
                label: "VRF proof",
                value: <HexDisplay value={decoded.vrf_proof} />,
              },
            ]}
          />
        ),
      }
    : null
}

const RandVRFPreDigest = Struct({
  vrf_output: Hex(32),
  vrf_proof: Hex(64),
})
const decodeRandVrfConsensus = createDecodeDigestFn(RandVRFPreDigest)
