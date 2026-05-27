import { LoadingMetadata } from "@/components/Loading"
import { MetadataEntryInput } from "@/components/MetadataEntryInput"
import { withSubscribe } from "@/components/withSuspense"
import { Route, Routes } from "react-router-dom"
import { CenteredScrollContainer } from "../AppShell"
import { RuntimeCallQuery } from "./RuntimeCallQuery"
import { RuntimeCallResults } from "./RuntimeCallResults"
import { runtimeCallEntryState } from "./runtimeCalls.state"

export const RuntimeCalls = withSubscribe(
  () => (
    <CenteredScrollContainer className="p-4 pb-0 flex flex-col gap-2 items-start">
      <MetadataEntryInput
        state={runtimeCallEntryState}
        labels={{
          group: "API",
          item: "Method",
        }}
      />
      <RuntimeCallQuery />
      <Routes>
        <Route path=":callId" element={<RuntimeCallResults />} />
      </Routes>
    </CenteredScrollContainer>
  ),
  {
    fallback: <LoadingMetadata />,
  },
)
