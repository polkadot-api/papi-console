import { VaultTxModal } from "polkahub"
import { Navigate, Route, Routes } from "react-router-dom"
import { ConnectionState } from "./components/ConnectionState"
import { Accounts } from "./pages/Accounts/Accounts"
import { AppShell } from "./pages/AppShell"
import { Constants } from "./pages/Constants"
import { Explorer } from "./pages/Explorer"
import { Extrinsics } from "./pages/Extrinsics"
import { Metadata } from "./pages/Metadata"
import { RpcCalls } from "./pages/RpcCalls"
import { RuntimeCalls } from "./pages/RuntimeCalls"
import { Storage } from "./pages/Storage"
import { Transactions } from "./pages/Transactions"
import { ViewFns } from "./pages/ViewFns"

export default function App() {
  return (
    <div className="w-full h-screen bg-background">
      <AppShell>
        <Routes>
          <Route path="explorer/*" element={<Explorer />} />
          <Route path="extrinsics/*" element={<Extrinsics />} />
          <Route path="storage/*" element={<Storage />} />
          <Route path="constants/*" element={<Constants />} />
          <Route path="runtimeCalls/*" element={<RuntimeCalls />} />
          <Route path="rpcCalls/*" element={<RpcCalls />} />
          <Route path="metadata/*" element={<Metadata />} />
          <Route path="accounts/*" element={<Accounts />} />
          <Route path="viewFns/*" element={<ViewFns />} />
          <Route path="*" element={<Navigate to="/explorer" replace />} />
        </Routes>
      </AppShell>
      <Transactions />
      <VaultTxModal />
      <ConnectionState />
    </div>
  )
}
