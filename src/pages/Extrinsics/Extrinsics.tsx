import { ButtonGroup } from "@/components/ButtonGroup"
import { LoadingMetadata } from "@/components/Loading"
import { withSubscribe } from "@/components/withSuspense"
import { useNavigate } from "@/hashParams"
import { Route, Routes, useMatch } from "react-router-dom"
import { ExtrinsicAnalyzer } from "./Analyzer/ExtrinsicAnalyzer"
import { CreateExtrinsic } from "./CreateExtrinsic"

export const Extrinsics = withSubscribe(
  () => {
    const isAnalyzer = !!useMatch("/extrinsics/analyzer")
    const navigate = useNavigate()

    return (
      <div className="flex-1 overflow-hidden p-2 flex flex-col @container">
        <ButtonGroup
          value={isAnalyzer ? "analyze" : "create"}
          onValueChange={(mode) =>
            navigate(`/extrinsics` + (mode === "analyze" ? `/analyzer` : ""))
          }
          items={[
            {
              value: "create",
              content: "Create",
            },
            {
              value: "analyze",
              content: "Analyze",
            },
          ]}
        />
        <Routes>
          <Route path="analyzer" element={<ExtrinsicAnalyzer />} />
          <Route path="*" element={<CreateExtrinsic />} />
        </Routes>
      </div>
    )
  },
  {
    fallback: <LoadingMetadata />,
  },
)
