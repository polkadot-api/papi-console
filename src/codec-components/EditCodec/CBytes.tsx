import { BinaryInput } from "@/components/BinaryInput"
import { EditBytes, EditFixedBytes, NOTIN } from "@polkadot-api/react-builder"
import { Binary } from "polkadot-api"

export const CBytes: EditBytes = ({ value, onValueChanged }) => (
  <BinaryInput encodedValue={value} onValueChanged={onValueChanged} />
)

export const CFixedBytes: EditFixedBytes = ({ value, onValueChanged, len }) => (
  <BinaryInput
    encodedValue={value === NOTIN ? value : Binary.fromHex(value)}
    onValueChanged={(v) => onValueChanged(v === NOTIN ? v : Binary.toHex(v))}
    len={len}
  />
)
