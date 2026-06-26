import { ButtonGroup } from "@/components/ButtonGroup"
import { Forklift } from "@/components/Icons"
import { LoadingMetadata } from "@/components/Loading"
import { withSubscribe } from "@/components/withSuspense"
import { createState } from "@/lib/externalState"
import { canSetStorage$ } from "@/state/chains/chain.state"
import { useStateObservable } from "@react-rxjs/core"
import { FC } from "react"
import { Route, Routes } from "react-router-dom"
import { StorageDecode } from "./StorageDecode"
import { StorageQuery } from "./StorageQuery"
import { StorageSet } from "./StorageSet"
import { StorageSubscriptions } from "./StorageSubscriptions"
import { CenteredScrollContainer } from "../AppShell"

export const Storage = withSubscribe(
  () => (
    <CenteredScrollContainer className="p-4 pb-0 flex flex-col gap-2 items-start">
      <StorageEntry />
      <Routes>
        <Route path=":subId" element={<StorageSubscriptions />} />
      </Routes>
    </CenteredScrollContainer>
  ),
  {
    fallback: <LoadingMetadata />,
  },
)

export const [mode$, setMode] = createState<"query" | "decode" | "set">("query")

const StorageEntry: FC = () => {
  const canSetStorage = useStateObservable(canSetStorage$)
  const mode = useStateObservable(mode$)

  return (
    <div className="w-full">
      <ButtonGroup
        value={mode}
        onValueChange={setMode as any}
        items={[
          {
            value: "query",
            content: "Storage Query",
          },
          {
            value: "decode",
            content: "Decode Value",
          },
          ...(canSetStorage
            ? [
                {
                  value: "set",
                  content: (
                    <>
                      Set Value
                      <Forklift
                        className="inline-block align-middle ml-2"
                        size={20}
                      />
                    </>
                  ),
                },
              ]
            : []),
        ]}
      />
      <div className="border border-accent p-3 w-full">
        {mode === "query" ? (
          <StorageQuery />
        ) : mode === "decode" ? (
          <StorageDecode />
        ) : (
          <StorageSet />
        )}
      </div>
    </div>
  )
}
