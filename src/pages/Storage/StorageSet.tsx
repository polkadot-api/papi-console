import { LookupTypeEdit } from "@/codec-components/LookupTypeEdit"
import { Chopsticks } from "@/components/Icons"
import { Button } from "@/components/ui/button"
import { chainClient$, client$, lookup$ } from "@/state/chains/chain.state"
import { getTypeComplexity } from "@/utils"
import { state, useStateObservable } from "@react-rxjs/core"
import { createSignal } from "@react-rxjs/utils"
import { fromHex, toHex } from "polkadot-api/utils"
import { FC, useState } from "react"
import {
  combineLatest,
  filter,
  firstValueFrom,
  map,
  merge,
  of,
  switchMap,
  withLatestFrom,
} from "rxjs"
import { encodedKey$, KeyInput, StorageKeysInput } from "./StorageQuery"
import { storageEntryState } from "./storage.state"

const [setValue$, setValue] = createSignal<Uint8Array | "partial" | null>()
const currentValue$ = state(
  merge(
    combineLatest([encodedKey$, chainClient$]).pipe(
      switchMap(([key, client]) =>
        (key
          ? client.chainHead
              .storage$(null, "value", () => key, null)
              .pipe(map(({ value }) => value))
          : of(null)
        ).pipe(
          withLatestFrom(
            lookup$,
            storageEntryState.selectedEntry$.pipe(filter((v) => v != null)),
          ),
          map(([v, lookup, entry]) => {
            if (v != null) return fromHex(v)

            const pallet = lookup.metadata.pallets.find(
              (p) => p.name == entry.pallet,
            )!
            const storageItem = pallet.storage!.items.find(
              (i) => i.name === entry.entry,
            )!

            return storageItem.modifier ? fromHex(storageItem.fallback) : null
          }),
        ),
      ),
    ),
    setValue$,
  ).pipe(
    withLatestFrom(encodedKey$),
    map(([value, encodedKey]) => ({ value, encodedKey })),
  ),
  null,
)

export const StorageSet: FC = () => {
  const selectedEntry = useStateObservable(storageEntryState.selectedEntry$)
  const lookup = useStateObservable(lookup$)
  const currentValue = useStateObservable(currentValue$)
  const [isLoading, setIsLoading] = useState(false)

  if (!lookup || !selectedEntry) return null

  const shape = lookup(selectedEntry.value)
  const complexity = getTypeComplexity(shape)

  return (
    <div className="flex flex-col gap-4 items-start w-full overflow-hidden">
      <KeyInput />
      <StorageKeysInput disableToggle />
      {currentValue && currentValue.encodedKey ? (
        <>
          <LookupTypeEdit
            /* A bit of a shame… this component doesn't change the value reactively... */
            key={currentValue.encodedKey}
            className="w-full border rounded pt-2"
            type={selectedEntry.value}
            value={currentValue.value}
            onValueChange={setValue}
            tree={complexity === "tree"}
          />
          <Button
            variant="secondary"
            disabled={
              isLoading ||
              !currentValue.encodedKey ||
              !(currentValue.value instanceof Uint8Array)
            }
            onClick={async () => {
              setIsLoading(true)
              try {
                if (
                  !currentValue.encodedKey ||
                  !(currentValue.value instanceof Uint8Array)
                )
                  return false

                const client = await firstValueFrom(client$)
                await client._request("dev_setStorage", [
                  [[currentValue.encodedKey, toHex(currentValue.value)]],
                ])

                await client._request("dev_newBlock", [])
              } finally {
                setIsLoading(false)
              }
            }}
          >
            Set Storage
            <Chopsticks />
          </Button>
        </>
      ) : null}
    </div>
  )
}
