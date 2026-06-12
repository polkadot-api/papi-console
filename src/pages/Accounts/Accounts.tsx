import { CenteredScrollContainer } from "../AppShell"
import { AccountList } from "./AccountList"
import { Providers } from "./Providers"
import "./Locks"

export const Accounts = () => {
  return (
    <CenteredScrollContainer className="p-4 space-y-4">
      <Providers />
      <AccountList />
    </CenteredScrollContainer>
  )
}
