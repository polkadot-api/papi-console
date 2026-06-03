import { Hex, Struct } from "@polkadot-api/substrate-bindings"
import { HexString } from "polkadot-api"
import { createDecodeDigestFn, FieldGrid, HexDisplay } from "./components"

export const ismpConsensus = (payload: HexString) => {
  const decoded = decodeIsmpConsensus(payload)
  return decoded
    ? {
        summary: {
          label: "Child trie",
          value: <HexDisplay value={decoded.childTrieRoot} />,
        },
        details: (
          <FieldGrid
            fields={[
              {
                label: "MMR root",
                value: <HexDisplay value={decoded.mmrRoot} />,
              },
            ]}
          />
        ),
      }
    : null
}

const IsmpConsensusDigest = Struct({
  mmrRoot: Hex(32),
  childTrieRoot: Hex(32),
})
const decodeIsmpConsensus = createDecodeDigestFn(IsmpConsensusDigest)
