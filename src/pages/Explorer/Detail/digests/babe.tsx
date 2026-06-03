import {
  _void,
  Bytes,
  Struct,
  u32,
  u64,
  Variant,
} from "@polkadot-api/substrate-bindings"
import { HexString } from "polkadot-api"
import { toHex } from "polkadot-api/utils"
import { createDecodeDigestFn, FieldGrid, HexDisplay } from "./components"

export const babePreDigest = (payload: HexString) => {
  const decoded = decodeBabePreRuntime(payload)
  if (!decoded) return null

  const digestValue =
    decoded.value && typeof decoded.value == "object"
      ? decoded.value
      : {
          authority_index: null,
          slot: null,
        }
  const vrf =
    decoded.value &&
    typeof decoded.value == "object" &&
    "vrf_signature" in decoded.value
      ? decoded.value.vrf_signature
      : null

  return {
    summary:
      digestValue.slot != null
        ? { label: "Slot", value: digestValue.slot.toString() }
        : { label: "Kind", value: decoded.type },
    details: (
      <FieldGrid
        fields={[
          { label: "Kind", value: decoded.type },
          digestValue.authority_index != null
            ? {
                label: "Authority",
                value: `#${digestValue.authority_index}`,
              }
            : null,
          vrf
            ? {
                label: "VRF output",
                value: <HexDisplay value={toHex(vrf.pre_output)} />,
              }
            : null,
          vrf
            ? {
                label: "VRF proof",
                value: <HexDisplay value={toHex(vrf.proof)} />,
              }
            : null,
        ]}
      />
    ),
  }
}

const DigestWithVRF = Struct({
  authority_index: u32,
  slot: u64,
  vrf_signature: Struct({
    pre_output: Bytes(32),
    proof: Bytes(64),
  }),
})
const BabePreDigest = Variant({
  Unknown: _void,
  Primary: DigestWithVRF,
  SecondaryPlain: Struct({
    authority_index: u32,
    slot: u64,
  }),
  SecondaryVRF: DigestWithVRF,
})
export const decodeBabePreRuntime = createDecodeDigestFn(BabePreDigest)
