import { AccountList } from "./AccountList"
import { Providers } from "./Providers"

export const Accounts = () => {
  return (
    <div className="p-4 space-y-4">
      <Providers />
      <AccountList />
    </div>
  )
}
