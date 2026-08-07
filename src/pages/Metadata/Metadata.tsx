import { ButtonGroup } from "@/components/ButtonGroup"
import { JsonDisplay } from "@/components/JsonDisplay"
import { LoadingMetadata } from "@/components/Loading"
import { withSubscribe } from "@/components/withSuspense"
import { useNavigate } from "@/hashParams"
import { metadata$ } from "@/state/chains/chain.state"
import { lookupTypeToText } from "../ScaleTool/typeToText"
import { useStateObservable } from "@react-rxjs/core"
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useParams,
} from "react-router-dom"
import { CenteredScrollContainer } from "../AppShell"
import { Extrinsic } from "./Extrinsic"
import { Lookup, LookupContext } from "./Lookup"
import { Pallets } from "./Pallets"
import { RuntimeApis } from "./RuntimeApis"
import { Custom, OuterEnums } from "./V15Fields"

export const Metadata = withSubscribe(
  () => (
    <Routes>
      <Route path="lookup/editor/:id" element={<LegacyEditorRedirect />} />
      <Route path=":mode?" element={<MetadataExplorer />} />
    </Routes>
  ),
  {
    fallback: <LoadingMetadata />,
  },
)

const MetadataExplorer = () => {
  const params = useParams()
  const navigate = useNavigate()
  const mode = params.mode || "pallets"
  const setMode = (mode: string) =>
    navigate("../" + mode, {
      replace: true,
    })
  const metadata = useStateObservable(metadata$)

  const tabs = [
    {
      id: "pallets",
      label: "Pallets",
      element: <Pallets pallets={metadata.pallets} />,
    },
    {
      id: "apis",
      label: "Runtime APIs",
      element: <RuntimeApis apis={metadata.apis} />,
    },
    {
      id: "extrinsic",
      label: "Extrinsic",
      element: <Extrinsic extrinsic={metadata.extrinsic} />,
    },
    {
      id: "lookup",
      label: "Lookup",
      element: <Lookup />,
    },
    ...("outerEnums" in metadata
      ? [
          {
            id: "outerEnums",
            label: "Outer Enums",
            element: <OuterEnums outerEnums={metadata.outerEnums} />,
          },
          {
            id: "custom",
            label: "Custom",
            element: <Custom custom={metadata.custom} />,
            disabled: metadata.custom.length === 0,
          },
        ]
      : []),
    {
      id: "json",
      label: "JSON",
      element: <JsonDisplay src={metadata} />,
    },
  ].filter((v) => !v.disabled)

  return (
    <CenteredScrollContainer className="p-4 pb-0 flex flex-col overflow-auto items-start gap-2">
      <ButtonGroup
        value={mode}
        onValueChange={setMode as any}
        items={tabs.map((tab) => ({
          value: tab.id,
          content: tab.label,
        }))}
      />
      <LookupContext.Provider value={metadata.lookup}>
        <div className="w-full flex flex-col">
          {tabs.find((t) => t.id === mode)?.element}
        </div>
      </LookupContext.Provider>
    </CenteredScrollContainer>
  )
}

const LegacyEditorRedirect = () => {
  const { id } = useParams()
  const location = useLocation()
  const metadata = useStateObservable(metadata$)
  const params = new URLSearchParams(location.hash.slice(1))
  try {
    params.set("type", lookupTypeToText(metadata.lookup, Number(id)))
  } catch {
    params.delete("type")
  }
  return (
    <Navigate
      to={{ pathname: "/scale-tool", hash: `#${params.toString()}` }}
      replace
    />
  )
}
