import { EditAccountId, NOTIN } from "@polkadot-api/react-builder"
import { AddressInput } from "polkahub"

export const CAccountId: EditAccountId = ({ value, onValueChanged }) => (
  <AddressInput
    className="w-64"
    triggerClassName="h-9 bg-input"
    value={value === NOTIN ? null : value}
    onChange={(v) => onValueChanged(v === null ? NOTIN : v)}
    disableClear
  />
)
