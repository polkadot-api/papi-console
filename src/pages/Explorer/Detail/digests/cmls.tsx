import {
  _void,
  bool,
  compactNumber,
  Hex,
  Struct,
  u8,
  Variant,
} from "@polkadot-api/substrate-bindings"
import { HexString } from "polkadot-api"
import { createDecodeDigestFn, FieldGrid, HexDisplay } from "./components"

export const cmlsPreDigest = (payload: HexString) => {
  const decoded = decodeCmlsPreRuntime(payload)
  if (!decoded) return null

  if (decoded.type === "BlockBundleInfo") {
    return {
      summary: { label: "Bundle", value: `#${decoded.value.index}` },
      details: (
        <FieldGrid
          fields={[
            {
              label: "Is last",
              value: decoded.value.isLast ? "Yes" : "No",
            },
          ]}
        />
      ),
    }
  }
  if (decoded.type === "CoreInfo") {
    return {
      summary: {
        label: "Core info selector",
        value: `${decoded.value.selector}`,
      },
      details: (
        <FieldGrid
          fields={[
            {
              label: "Claim offset",
              value: decoded.value.claimQueueOffset.toString(),
            },
            {
              label: "Cores",
              value: decoded.value.numberOfCores.toString(),
            },
          ]}
        />
      ),
    }
  }
  if (decoded.type === "RelayParent") {
    return {
      summary: {
        label: "Relay parent",
        value: <HexDisplay value={decoded.value} />,
      },
      details: null,
    }
  }
  return { summary: { label: "Kind", value: decoded.type }, details: null }
}

const ClmsDigestItem = Variant({
  RelayParent: Hex(32),
  CoreInfo: Struct({
    selector: u8,
    claimQueueOffset: u8,
    numberOfCores: compactNumber,
  }),
  BlockBundleInfo: Struct({
    index: u8,
    isLast: bool,
  }),
  UseFullCore: _void,
})
const decodeCmlsPreRuntime = createDecodeDigestFn(ClmsDigestItem)
