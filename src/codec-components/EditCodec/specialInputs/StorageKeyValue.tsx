import { ListItem } from "@/codec-components/common/ListItem"
import { EditArray } from "@polkadot-api/react-builder"
import { StorageKey } from "./StorageKey"
import { Binary, HexString } from "polkadot-api"

const decodeBinary = (value: Uint8Array | HexString) =>
  typeof value === "string" ? Binary.fromHex(value) : Binary.fromBytes(value)

export const StorageKeyValue: EditArray = ({ value, onValueChanged, path }) => {
  return (
    <ul>
      <ListItem idx={0} path={[...path, "0"]}>
        <StorageKey
          decode={decodeBinary}
          onValueChanged={}
          path={[...path, "0"]}
          type=""
        />
      </ListItem>
    </ul>
  )
}
