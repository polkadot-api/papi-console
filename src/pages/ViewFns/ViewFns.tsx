import { lookup$ } from "@/state/chains/chain.state"
import { DocsRenderer } from "@/components/DocsRenderer"
import { LoadingMetadata } from "@/components/Loading"
import { SearchableSelect } from "@/components/Select"
import { withSubscribe } from "@/components/withSuspense"
import { state, useStateObservable } from "@react-rxjs/core"
import { useEffect, useState } from "react"
import { map } from "rxjs"
import { ViewFnResults } from "./ViewFnResults"
import { selectedEntry$, setSelectedFn } from "./viewFns.state"
import { ViewFnQuery } from "./ViewFnQuery"

const metadataViewFns$ = state(
  lookup$.pipe(
    map((lookup) => ({
      lookup,
      entries: Object.fromEntries(
        lookup.metadata.pallets
          .filter((p) => p.viewFns.length)
          .map((p) => [
            p.name,
            Object.fromEntries(
              p.viewFns.map((method) => [method.name, method]),
            ),
          ]),
      ),
    })),
  ),
)

export const ViewFns = withSubscribe(
  () => {
    const { lookup, entries } = useStateObservable(metadataViewFns$)
    const defaultPallet = Object.keys(entries)[0] ?? null
    const defaultFn = defaultPallet
      ? Object.keys(entries[defaultPallet])[0]
      : null
    const [pallet, setPallet] = useState<string | null>(defaultPallet)
    const [fnName, setFnName] = useState<string | null>(defaultFn)
    const entry = useStateObservable(selectedEntry$)

    const selectedPallet =
      (pallet && lookup.metadata.pallets.find((p) => p.name === pallet)) || null

    useEffect(
      () =>
        setFnName((prev) => {
          if (!selectedPallet?.viewFns[0]) return null
          return selectedPallet.viewFns.some((v) => v.name === prev)
            ? prev
            : selectedPallet.viewFns[0].name
        }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [selectedPallet?.name],
    )

    useEffect(() => {
      const selectedMethod =
        (fnName && selectedPallet?.viewFns.find((it) => it.name === fnName)) ||
        null
      setSelectedFn(
        selectedMethod
          ? { ...selectedMethod, pallet: selectedPallet!.name }
          : null,
      )
    }, [selectedPallet, fnName])

    return (
      <div className="p-4 pb-0 flex flex-col gap-2 items-start">
        <div className="flex items-center gap-2">
          <label>
            Pallet
            <SearchableSelect
              value={pallet}
              setValue={(v) => setPallet(v)}
              options={Object.keys(entries).map((e) => ({
                text: e,
                value: e,
              }))}
            />
          </label>
          {selectedPallet && pallet && (
            <label>
              Function
              <SearchableSelect
                value={fnName}
                setValue={(v) => setFnName(v)}
                options={
                  Object.keys(entries[pallet]).map((s) => ({
                    text: s,
                    value: s,
                  })) ?? []
                }
              />
            </label>
          )}
        </div>
        {!!entry?.docs.length && (
          <div className="w-full">
            Docs
            <DocsRenderer docs={entry.docs} />
          </div>
        )}
        <ViewFnQuery />
        <ViewFnResults />
      </div>
    )
  },
  {
    fallback: <LoadingMetadata />,
  },
)
