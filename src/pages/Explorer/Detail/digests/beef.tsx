import {
  _void,
  Hex,
  Struct,
  u32,
  u64,
  Variant,
  Vector,
} from "@polkadot-api/substrate-bindings"
import { HexString } from "polkadot-api"
import { createDecodeDigestFn, FieldList, HexDisplay } from "./components"

export const beefyConsensus = (payload: HexString) => {
  const decoded = decodeBeefyConsensus(payload)
  if (!decoded) return null
  if (decoded.type === "AuthoritiesChange") {
    return {
      summary: {
        label: "AuthoritiesChange",
        value: decoded.value.id.toString(),
      },
      details: (
        <FieldList
          title="Validators"
          values={decoded.value.validators.map((hash) => (
            <HexDisplay value={hash} />
          ))}
        />
      ),
    }
  }
  if (decoded.type === "MmrRoot") {
    return {
      summary: {
        label: "MMR root",
        value: <HexDisplay value={decoded.value} />,
      },
      details: null,
    }
  }
  if (decoded.type === "OnDisabled") {
    return {
      summary: { label: "OnDisabled", value: `#${decoded.value}` },
      details: null,
    }
  }
  return { summary: { label: "Kind", value: decoded.type }, details: null }
}

const BeefyConsensusLog = Variant({
  Unknown: _void,
  AuthoritiesChange: Struct({
    validators: Vector(Hex(33)),
    id: u64,
  }),
  OnDisabled: u32,
  MmrRoot: Hex(32),
})
const decodeBeefyConsensus = createDecodeDigestFn(BeefyConsensusLog)
