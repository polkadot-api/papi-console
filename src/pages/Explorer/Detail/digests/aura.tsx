import { Struct, u64 } from "@polkadot-api/substrate-bindings"
import { HexString } from "polkadot-api"
import { createDecodeDigestFn } from "./components"

export const auraPreDigest = (payload: HexString) => {
  const decoded = decodeAuraPreRuntime(payload)
  return decoded
    ? {
        summary: { label: "Slot", value: decoded.slot.toString() },
        details: null,
      }
    : null
}

const AuraDigest = Struct({
  slot: u64,
})
export const decodeAuraPreRuntime = createDecodeDigestFn(AuraDigest)
