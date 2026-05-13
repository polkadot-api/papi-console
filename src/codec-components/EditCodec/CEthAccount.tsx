import { CopyText } from "@/components/Copy"
import { EditEthAccount, NOTIN } from "@polkadot-api/react-builder"
import { AddressInput } from "polkahub"

export const CEthAccount: EditEthAccount = ({ value, onValueChanged }) => (
  <div className="flex items-center gap-2">
    <AddressInput
      className="w-64"
      triggerClassName="h-9 bg-input"
      value={value === NOTIN ? null : value}
      onChange={(v) => onValueChanged(v === null ? NOTIN : v)}
      format="eth"
      disableClear
    />
    <CopyText text={value === NOTIN ? "" : value} disabled={value === NOTIN} />
  </div>
)
