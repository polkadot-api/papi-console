import { cn } from "@/lib/utils"
import { AccountPicker } from "@polkahub/ui-components"
import {
  AddressIdentity,
  useAvailableAccounts,
  useSelectedAccount,
} from "polkahub"
import { FC } from "react"

const groupLabels: Record<string, string> = {
  ledger: "Ledger",
  readonly: "Read Only",
  "polkadot-vault": "Vault",
  walletconnect: "Wallet Connect",
}

export const SelectAccount: FC<{
  className?: string
}> = ({ className }) => {
  const availableAccounts = useAvailableAccounts()
  const [account, setAccount] = useSelectedAccount()

  const groups = Object.entries(availableAccounts)
    .map(
      ([group, accounts]) =>
        [group, accounts.filter((acc) => acc.signer)] as const,
    )
    .filter(([, accounts]) => accounts.length > 0)
    .map(([key, accounts]) => ({
      name: groupLabels[key] ?? key,
      accounts,
    }))

  if (!groups.length && !account)
    return (
      <div className="w-full rounded border h-8 bg-muted text-muted-foreground flex items-center p-2">
        Configure your signer to select one
      </div>
    )

  return (
    <AccountPicker
      value={account}
      onChange={setAccount}
      groups={groups}
      className={cn(className, "max-w-auto w-full")}
      renderAddress={(account) => (
        <AddressIdentity
          addr={account.address}
          name={account?.name}
          copyable={false}
        />
      )}
      disableClear
    />
  )
}
