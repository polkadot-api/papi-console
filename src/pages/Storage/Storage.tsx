import { isChopsticks$ } from "@/chopsticks/chopsticks"
import { ButtonGroup } from "@/components/ButtonGroup"
import { DocsRenderer } from "@/components/DocsRenderer"
import { Chopsticks } from "@/components/Icons"
import { LoadingMetadata } from "@/components/Loading"
import { SearchableSelect } from "@/components/Select"
import { withSubscribe } from "@/components/withSuspense"
import { useHashState } from "@/lib/externalState"
import { lookup$ } from "@/state/chains/chain.state"
import { state, useStateObservable } from "@react-rxjs/core"
import { FC, useEffect, useState } from "react"
import { map } from "rxjs"
import { selectedEntry$, setSelectEntryFromMetadata } from "./storage.state"
import { StorageDecode } from "./StorageDecode"
import { StorageQuery } from "./StorageQuery"
import { StorageSet } from "./StorageSet"
import { StorageSubscriptions } from "./StorageSubscriptions"

const metadataStorage$ = state(
  lookup$.pipe(
    map((lookup) => ({
      lookup,
      entries: Object.fromEntries(
        lookup.metadata.pallets
          .filter((p) => p.storage)
          .map((p) => [
            p.name,
            Object.fromEntries(
              p.storage!.items.map((item) => [item.name, item.type]),
            ),
          ]),
      ),
    })),
  ),
)

export const Storage = withSubscribe(
  () => {
    const { lookup, entries } = useStateObservable(metadataStorage$)
    const [pallet, setPallet] = useHashState("pallet", "System")
    const [entry, setEntry] = useHashState("entry", "Account")
    const selectedEntry = useStateObservable(selectedEntry$)

    const selectedPallet =
      (pallet && lookup.metadata.pallets.find((p) => p.name === pallet)) || null

    useEffect(
      () =>
        setEntry((prev) => {
          if (!selectedPallet?.storage?.items[0]) return null
          return selectedPallet.storage.items.some((v) => v.name === prev)
            ? prev
            : selectedPallet.storage.items[0].name
        }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [selectedPallet?.name],
    )

    useEffect(() => {
      const storageEntry =
        (entry &&
          selectedPallet?.storage?.items.find((it) => it.name === entry)) ||
        null
      setSelectEntryFromMetadata(lookup, pallet!, storageEntry)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedPallet, entry])

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
              Entry
              <SearchableSelect
                value={entry}
                setValue={(v) => setEntry(v)}
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
        {selectedEntry?.docs.length ? (
          <div className="w-full">
            Docs
            <DocsRenderer docs={selectedEntry.docs} />
          </div>
        ) : null}
        <StorageEntry />
        <StorageSubscriptions />
      </div>
    )
  },
  {
    fallback: <LoadingMetadata />,
  },
)

const StorageEntry: FC = () => {
  const selectedEntry = useStateObservable(selectedEntry$)
  const canSetStorage = useStateObservable(isChopsticks$)
  const [mode, setMode] = useState<"query" | "decode" | "set">("query")

  if (!selectedEntry) return null

  return (
    <>
      <ButtonGroup
        value={mode}
        onValueChange={setMode as any}
        items={[
          {
            value: "query",
            content: "Query",
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
                      Set
                      <Chopsticks
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
      {mode === "query" ? (
        <StorageQuery />
      ) : mode === "decode" ? (
        <StorageDecode />
      ) : (
        <StorageSet />
      )}
    </>
  )
}
