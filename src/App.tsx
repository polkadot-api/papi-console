import { Navigate, Route, Routes } from "react-router-dom"
import { Accounts } from "./pages/Accounts/Accounts"
import { Constants } from "./pages/Constants"
import { Explorer } from "./pages/Explorer"
import { Extrinsics } from "./pages/Extrinsics"
import { Header } from "./pages/Header"
import { Metadata } from "./pages/Metadata"
import { RpcCalls } from "./pages/RpcCalls"
import { RuntimeCalls } from "./pages/RuntimeCalls"
import { Storage } from "./pages/Storage"
import { Transactions } from "./pages/Transactions"
import { VaultTxModal } from "polkahub"

export default function App() {
  return (
    <div className="w-full h-screen bg-background flex flex-col">
      <Header />
      <div className="flex-1 overflow-auto relative">
        <div className="max-w-(--breakpoint-xl) m-auto">
          <Routes>
            <Route path="explorer/*" element={<Explorer />} />
            <Route path="extrinsics/*" element={<Extrinsics />} />
            <Route path="storage/*" element={<Storage />} />
            <Route path="constants/*" element={<Constants />} />
            <Route path="runtimeCalls/*" element={<RuntimeCalls />} />
            <Route path="rpcCalls/*" element={<RpcCalls />} />
            <Route path="metadata/*" element={<Metadata />} />
            <Route path="accounts/*" element={<Accounts />} />
            <Route path="*" element={<Navigate to="/explorer" replace />} />
          </Routes>
        </div>
      </div>
      <Transactions />
      <VaultTxModal />
    </div>
  )
}
