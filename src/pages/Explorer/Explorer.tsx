import { LoadingBlocks } from "@/components/Loading"
import { withSubscribe } from "@/components/withSuspense"
import { Route, Routes } from "react-router-dom"
import { BlockTable } from "./BlockTable"
import { BlockDetail } from "./Detail"
import { Events } from "./Events"
import { Summary } from "./Summary"

export const Explorer = withSubscribe(
  () => (
    <Routes>
      <Route path=":hash" element={<BlockDetail />} />
      <Route
        path="*"
        element={
          <div className="overflow-auto p-4 pb-0">
            <Summary />
            <div className="flex gap-2 lg:gap-8 items-start flex-wrap lg:flex-nowrap">
              <BlockTable />
              <Events />
            </div>
          </div>
        }
      />
    </Routes>
  ),
  {
    fallback: <LoadingBlocks />,
  },
)
