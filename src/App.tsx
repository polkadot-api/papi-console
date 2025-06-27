import { Navigate, Route, Routes } from "react-router-dom"
import { Constants } from "./pages/Constants"
import { Explorer } from "./pages/Explorer"
import { Extrinsics } from "./pages/Extrinsics"
import { Header } from "./pages/Header"
import { Metadata } from "./pages/Metadata"
import { RuntimeCalls } from "./pages/RuntimeCalls"
import { Storage } from "./pages/Storage"
import { Transactions } from "./pages/Transactions"

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
            <Route path="metadata/*" element={<Metadata />} />
            <Route path="*" element={<Navigate to="/explorer" replace />} />
          </Routes>
        </div>
      </div>
      <Transactions />
    </div>
  )
}
