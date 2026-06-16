import { Navigate, Route, Routes } from "react-router-dom"
import { CenteredScrollContainer } from "../AppShell"
import { AccountList } from "./AccountList"
import { Locks } from "./Locks"
import { Providers } from "./Providers"

export const Accounts = () => {
  return (
    <Routes>
      <Route
        index
        element={
          <CenteredScrollContainer className="p-4 space-y-4">
            <Providers />
            <AccountList />
          </CenteredScrollContainer>
        }
      />
      <Route
        path="locks/:accountId"
        element={
          <CenteredScrollContainer className="p-4">
            <Locks />
          </CenteredScrollContainer>
        }
      />
      <Route path="*" element={<Navigate to="/accounts" replace />} />
    </Routes>
  )
}
