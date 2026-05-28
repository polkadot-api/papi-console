import { BlockPicker, selectedBlock$ } from "@/pages/Storage/BlockPicker"
import { CachedRuntime } from "@/state/chains/chain.state"
import { state, useStateObservable } from "@react-rxjs/core"
import { createSignal, mergeWithKey } from "@react-rxjs/utils"
import { Info } from "lucide-react"
import { FC } from "react"
import { combineLatest, defer, map, scan } from "rxjs"
import { DocsRenderer } from "./DocsRenderer"
import { Popover } from "./Popover"
import { SearchableSelect } from "./Select"

export const createMetadataEntryState = <T extends { docs?: string[] }>(
  getEntries: (ctx: CachedRuntime) => Record<string, string[]>,
  initialValue: (entries: Record<string, string[]>) => {
    group: string | null
    item: string | null
  },
  getEntry: (ctx: CachedRuntime, entry: { group: string; item: string }) => T,
) => {
  const [entryChange$, selectEntry] = createSignal<{
    group?: string | null
    item?: string | null
  }>()

  const groupEntries$ = state(
    selectedBlock$.pipe(map(({ ctx }) => getEntries(ctx))),
    {},
  )

  const emptyEntry = {
    group: null as string | null,
    item: null as string | null,
  }
  const initialValue$ = groupEntries$.pipe(map(initialValue))
  const partialSelection$ = defer(() =>
    mergeWithKey({ entryChange$, initialValue$ }).pipe(
      scan((acc, evt) => {
        if (evt.type === "initialValue$") {
          if (!acc.group) return evt.payload
          return acc
        }
        return {
          group: evt.payload.group ?? acc.group,
          item: evt.payload.item ?? acc.item,
        }
      }, emptyEntry),
    ),
  )

  const partialEntry$ = state(
    combineLatest([partialSelection$, groupEntries$]).pipe(
      map(([partialSelection, entries]) => {
        const result = { ...partialSelection }

        let selectedGroup = result.group ? entries[result.group] : null
        if (!selectedGroup) {
          result.group = Object.keys(entries)[0] ?? null
          if (!result.group) return emptyEntry

          selectedGroup = entries[result.group] ?? null
        }
        if (!result.item || !selectedGroup.includes(result.item)) {
          result.item = selectedGroup?.[0] ?? null
        }
        return result
      }),
    ),
    emptyEntry,
  )

  const selectedEntry$ = state(
    combineLatest([partialEntry$, selectedBlock$]).pipe(
      map(([partialEntry, { ctx }]): T | null => {
        const { group, item } = partialEntry
        if (!group || !item) return null
        const entries = getEntries(ctx)
        if (!entries[group]?.includes(item)) return null

        return getEntry(ctx, { group, item })
      }),
    ),
    null,
  )

  return {
    selectEntry,
    groupEntries$,
    partialEntry$,
    selectedEntry$,
  }
}
export type MetadataEntryState = ReturnType<typeof createMetadataEntryState>

export const MetadataEntryInput: FC<{
  state: MetadataEntryState
  labels: {
    group: string
    item: string
  }
}> = ({ state, labels }) => {
  const entries = useStateObservable(state.groupEntries$)
  const partialEntry = useStateObservable(state.partialEntry$)
  const selectedEntry = useStateObservable(state.selectedEntry$)

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 gap-x-3 gap-y-2 @3xl:grid-cols-3 max-w-2xl">
        <label>
          Block
          <BlockPicker />
        </label>
        <label>
          {labels.group}
          <SearchableSelect
            value={partialEntry.group}
            setValue={(v) => state.selectEntry({ group: v })}
            options={Object.keys(entries).map((e) => ({
              text: e,
              value: e,
            }))}
          />
        </label>
        {partialEntry.group && entries[partialEntry.group] && (
          <label className="max-w-52">
            <div className="flex items-center justify-between">
              {labels.item}
              {selectedEntry?.docs?.length ? (
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
              value={partialEntry.item}
              setValue={(v) => state.selectEntry({ item: v })}
              options={
                entries[partialEntry.group].map((s) => ({
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
