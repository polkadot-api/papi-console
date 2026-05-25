import { DocsRenderer } from "@/components/DocsRenderer"
import { Popover } from "@/components/Popover"
import { SearchableSelect } from "@/components/Select"
import { state, useStateObservable } from "@react-rxjs/core"
import { Info } from "lucide-react"
import { map } from "rxjs"
import { BlockPicker, selectedBlock$ } from "./BlockPicker"
import { partialEntry$, selectedEntry$, selectEntry } from "./storage.state"

const metadataStorage$ = state(
  selectedBlock$.pipe(
    map(({ ctx }) => ({
      lookup: ctx.lookup,
      entries: Object.fromEntries(
        ctx.lookup.metadata.pallets
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

export const StorageEntryPicker = () => {
  const { entries } = useStateObservable(metadataStorage$)
  const partialEntry = useStateObservable(partialEntry$)
  const selectedEntry = useStateObservable(selectedEntry$)

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 gap-x-3 gap-y-2 @3xl:grid-cols-3 max-w-2xl">
        <label>
          Block
          <BlockPicker />
        </label>
        <label>
          Pallet
          <SearchableSelect
            value={partialEntry.pallet}
            setValue={(v) => selectEntry({ pallet: v })}
            options={Object.keys(entries).map((e) => ({
              text: e,
              value: e,
            }))}
          />
        </label>
        {partialEntry.pallet && entries[partialEntry.pallet] && (
          <label className="max-w-52">
            <div className="flex items-center justify-between">
              Entry
              {selectedEntry?.docs.length ? (
                <Popover
                  content={
                    <DocsRenderer
                      docs={selectedEntry.docs}
                      className="max-h-none"
                    />
                  }
                >
                  <button
                    type="button"
                    tabIndex={-1}
                    className="text-muted-foreground"
                  >
                    <Info size={16} />
                  </button>
                </Popover>
              ) : null}
            </div>
            <SearchableSelect
              value={partialEntry.entry}
              setValue={(v) => selectEntry({ entry: v })}
              options={
                Object.keys(entries[partialEntry.pallet]).map((s) => ({
                  text: s,
                  value: s,
                })) ?? []
              }
            />
          </label>
        )}
      </div>
    </div>
  )
}
