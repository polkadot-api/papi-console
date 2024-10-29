import { Navigate, Route, Routes } from "react-router-dom"
import { Extrinsics } from "./pages/Extrinsics"
import { Header } from "./pages/Header"
import { RuntimeCalls } from "./pages/RuntimeCalls"
import { Storage } from "./pages/Storage"

export default function App() {
  return (
    <div className="w-full max-w-screen-lg h-screen bg-polkadot-950 flex flex-col">
      <Header />

      <Routes>
        <Route path="extrinsics/*" element={<Extrinsics />} />
        <Route path="storage/*" element={<Storage />} />
        <Route path="runtimeCalls/*" element={<RuntimeCalls />} />
        <Route path="*" element={<Navigate to="/extrinsics" replace />} />
      </Routes>
    </div>
  )
}
