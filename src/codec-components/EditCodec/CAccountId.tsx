import { AccountIdInput } from "@/components/AccountIdInput"
import { EditAccountId, NOTIN } from "@polkadot-api/react-builder"

export const CAccountId: EditAccountId = ({ value, onValueChanged }) => (
  <AccountIdInput
    value={value === NOTIN ? null : value}
    onValueChanged={(v) => onValueChanged(v === null ? NOTIN : v)}
  />
)
