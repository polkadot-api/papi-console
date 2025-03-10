import { lookup$ } from "@/state/chains/chain.state"
import { ButtonGroup } from "@/components/ButtonGroup"
import { SearchableSelect } from "@/components/Select"
import { withSubscribe } from "@/components/withSuspense"
import { state, useStateObservable } from "@react-rxjs/core"
import { FC, useEffect, useState } from "react"
import { map } from "rxjs"
import { selectedEntry$, setSelectedEntry } from "./storage.state"
import { StorageDecode } from "./StorageDecode"
import { StorageQuery } from "./StorageQuery"
import { StorageSubscriptions } from "./StorageSubscriptions"
import { DocsRenderer } from "@/components/DocsRenderer"
import { LoadingMetadata } from "@/components/Loading"
import { useHashState } from "@/lib/externalState"

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
      const storageEntryType = storageEntry?.type
      if (!storageEntryType) {
        return setSelectedEntry(null)
      }

      if (storageEntryType.tag === "plain") {
        return setSelectedEntry({
          value: storageEntryType.value,
          key: [],
          pallet: pallet!,
          entry: entry!,
          docs: storageEntry.docs,
        })
      }
      if (storageEntryType.value.hashers.length === 1) {
        return setSelectedEntry({
          value: storageEntryType.value.value,
          key: [storageEntryType.value.key],
          pallet: pallet!,
          entry: entry!,
          docs: storageEntry.docs,
        })
      }

      const keyDef = lookup(storageEntryType.value.key)
      const key = (() => {
        if (keyDef.type === "array") {
          return new Array(keyDef.len).fill(keyDef.value.id)
        }
        if (keyDef.type === "tuple") {
          return keyDef.value.map((e) => e.id)
        }
        throw new Error("Invalid key type " + keyDef.type)
      })()
      setSelectedEntry({
        key,
        value: storageEntryType.value.value,
        pallet: pallet!,
        entry: entry!,
        docs: storageEntry.docs,
      })
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
  const [mode, setMode] = useState<"query" | "decode">("query")

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
            content: "Decode",
          },
        ]}
      />
      {mode === "query" ? <StorageQuery /> : <StorageDecode />}
    </>
  )
}
