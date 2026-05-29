import { LoadingMetadata } from "@/components/Loading"
import { MetadataEntryInput } from "@/components/MetadataEntryInput"
import { withSubscribe } from "@/components/withSuspense"
import { Route, Routes } from "react-router-dom"
import { CenteredScrollContainer } from "../AppShell"
import { ViewFnQuery } from "./ViewFnQuery"
import { ViewFnResults } from "./ViewFnResults"
import { viewFnEntryState } from "./viewFns.state"

export const ViewFns = withSubscribe(
  () => (
    <CenteredScrollContainer className="p-4 pb-0 flex flex-col gap-2 items-start">
      <MetadataEntryInput
        state={viewFnEntryState}
        labels={{
          group: "Pallet",
          item: "Function",
        }}
      />
      <ViewFnQuery />
      <Routes>
        <Route path=":callId" element={<ViewFnResults />} />
      </Routes>
    </CenteredScrollContainer>
  ),
  {
    fallback: <LoadingMetadata />,
  },
)
