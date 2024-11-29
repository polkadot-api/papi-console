import { BinaryInput } from "@/components/BinaryInput"
import { EditBytes } from "@polkadot-api/react-builder"
import { StorageKey } from "./specialInputs/StorageKey"

export const CBytes: EditBytes = (props) => {
  const { value, onValueChanged, len, path } = props
  if (path.join(".").startsWith("System.kill_storage.")) {
    return <StorageKey {...props} />
  }

  return (
    <BinaryInput
      encodedValue={value}
      onValueChanged={onValueChanged}
      len={len}
    />
  )
}
