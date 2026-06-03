import {
  _void,
  Hex,
  Struct,
  Variant,
  Vector,
} from "@polkadot-api/substrate-bindings"
import { HexString } from "polkadot-api"
import { createDecodeDigestFn, FieldList, HexDisplay } from "./components"

export const fronConsensus = (payload: HexString) => {
  const decoded = decodeFrontierConsensus(payload)
  if (!decoded) return null
  if (decoded.type === "Hashes") {
    return {
      summary: {
        label: "Block Hash",
        value: <HexDisplay value={decoded.value.blockHash} />,
      },
      details: (
        <FieldList
          title="Tx Hashes"
          values={decoded.value.txHashes.map((hash) => (
            <HexDisplay value={hash} />
          ))}
        />
      ),
    }
  }
  return { summary: { label: "Kind", value: decoded.type }, details: [] }
}

const FrontierConsensusLog = Variant({
  Unknown: _void,
  Hashes: Struct({
    blockHash: Hex(32),
    txHashes: Vector(Hex(32)),
  }),
  // It's actually an ethereum block header, might be too long
  Block: _void,
})
const decodeFrontierConsensus = createDecodeDigestFn(FrontierConsensusLog)
