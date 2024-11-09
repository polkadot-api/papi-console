import { LoadingBlocks } from "@/components/Loading"
import { withSubscribe } from "@/components/withSuspense"
import { Route, Routes } from "react-router-dom"
import { BlockTable } from "./BlockTable"
import { BlockDetail } from "./Detail"
import { Events } from "./Events"
import { Summary } from "./Summary"
import { Suspense } from "react"

export const Explorer = withSubscribe(
  () => (
    <Routes>
      <Route path=":hash" element={<BlockDetail />} />
      <Route
        path="*"
        element={
          <div className="overflow-auto p-4 pb-0">
            <Suspense fallback="Summary">
              <Summary />
            </Suspense>
            <div className="flex gap-2 items-start flex-wrap lg:flex-nowrap">
              <Suspense fallback="Block table">
                <BlockTable />
              </Suspense>
              <Suspense fallback="Events">
                <Events />
              </Suspense>
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
