import { Navigate, Route, Routes } from "react-router-dom"
import { Constants } from "./pages/Constants"
import { Explorer } from "./pages/Explorer"
import { Extrinsics } from "./pages/Extrinsics"
import { Header } from "./pages/Header"
import { Footer } from "./pages/Footer"
import { Metadata } from "./pages/Metadata"
import { RuntimeCalls } from "./pages/RuntimeCalls"
import { Storage } from "./pages/Storage"
import { Transactions } from "./pages/Transactions"

export default function App() {
  return (
    <div className="w-full max-w-screen-lg h-screen bg-background flex flex-col">
      <Header />
      <div className="overflow-auto h-[89vh]">
      <Routes>
        <Route path="explorer/*" element={<Explorer />} />
        <Route path="extrinsics/*" element={<Extrinsics />} />
        <Route path="storage/*" element={<Storage />} />
        <Route path="constants/*" element={<Constants />} />
        <Route path="runtimeCalls/*" element={<RuntimeCalls />} />
        <Route path="metadata/*" element={<Metadata />} />
        <Route path="*" element={<Navigate to="/explorer" replace />} />
      </Routes>
      <Transactions />
      </div>
      <Footer />
    </div>
  )
}
