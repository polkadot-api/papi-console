import { AccountIdDisplay } from "@/components/AccountIdDisplay"
import { Enum, HexString, SS58String } from "polkadot-api"

const senderToAddress = (
  sender: Enum<{ Id: SS58String }> | SS58String | HexString,
) =>
  typeof sender === "string"
    ? sender
    : "type" in sender && sender.type === "Id"
      ? sender.value
      : null

export const Sender: React.FC<{
  sender: Enum<{ Id: SS58String }> | SS58String | HexString
}> = ({ sender }) => {
  const value = senderToAddress(sender)
  if (!value) return null
  return value ? <AccountIdDisplay value={value} /> : null
}
