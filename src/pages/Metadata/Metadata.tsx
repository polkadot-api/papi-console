import { LookupTypeEdit } from "@/codec-components/LookupTypeEdit"
import { ButtonGroup } from "@/components/ButtonGroup"
import { JsonDisplay } from "@/components/JsonDisplay"
import { LoadingMetadata } from "@/components/Loading"
import { withSubscribe } from "@/components/withSuspense"
import { useNavigate } from "@/hashParams"
import { lookup$, metadata$ } from "@/state/chains/chain.state"
import { getTypeComplexity } from "@/utils/shape"
import { useStateObservable } from "@react-rxjs/core"
import { useState } from "react"
import { Route, Routes, useParams } from "react-router-dom"
import { Extrinsic } from "./Extrinsic"
import { Lookup, LookupContext } from "./Lookup"
import { Pallets } from "./Pallets"
import { RuntimeApis } from "./RuntimeApis"
import { Custom, OuterEnums } from "./V15Fields"

export const Metadata = withSubscribe(
  () => (
    <Routes>
      <Route path="lookup/editor/:id" element={<Editor />} />
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
    <div className="p-4 pb-0 flex flex-col overflow-auto items-start gap-2">
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
    </div>
  )
}

const Editor = () => {
  const { id } = useParams()
  const lookup = useStateObservable(lookup$)
  const [value, setValue] = useState<Uint8Array | "partial" | null>(null)
  if (!lookup) return null
  const shape = lookup(Number(id))
  const complexity = getTypeComplexity(shape)

  return (
    <div className="p-4">
      <LookupTypeEdit
        type={Number(id)}
        value={value}
        onValueChange={setValue}
        tree={complexity === "tree"}
      />
    </div>
  )
}
