import { chopsticksInstance$ } from "@/chopsticks/chopsticks"
import { LookupTypeEdit } from "@/codec-components/LookupTypeEdit"
import { Chopsticks } from "@/components/Icons"
import { Button } from "@/components/ui/button"
import { chainClient$, lookup$ } from "@/state/chains/chain.state"
import { getTypeComplexity } from "@/utils"
import { toHex } from "@polkadot-api/utils"
import { state, useStateObservable } from "@react-rxjs/core"
import { createSignal } from "@react-rxjs/utils"
import { FC, useState } from "react"
import {
  combineLatest,
  filter,
  firstValueFrom,
  map,
  merge,
  switchMap,
  withLatestFrom,
} from "rxjs"
import { selectedEntry$ } from "./storage.state"
import { encodedKey$, KeyDisplay, StorageKeysInput } from "./StorageQuery"
import { Binary } from "polkadot-api"

const [setValue$, setValue] = createSignal<Uint8Array | "partial" | null>()
const currentValue$ = state(
  merge(
    combineLatest([
      encodedKey$.pipe(filter((v) => v != null)),
      selectedEntry$.pipe(filter((v) => v != null)),
      chainClient$,
    ]).pipe(
      switchMap(([key, entry, client]) =>
        client.chainHead.storage$(
          null,
          "value",
          () => key,
          null,
          (data, ctx) => {
            // We must comply with the original mapper, or the cache will contain a wrong value.
            const codec = ctx.dynamicBuilder.buildStorage(
              entry.pallet,
              entry.entry,
            )
            return data === null ? codec.fallback : codec.value.dec(data)
          },
        ),
      ),
      withLatestFrom(lookup$, selectedEntry$.pipe(filter((v) => v != null))),
      map(([v, lookup, entry]) => {
        if (v.raw !== null) return v.raw
        const pallet = lookup.metadata.pallets.find(
          (p) => p.name == entry.pallet,
        )!
        const storageItem = pallet.storage!.items.find(
          (i) => i.name === entry.entry,
        )!

        return storageItem.modifier ? storageItem.fallback : null
      }),
      map((v) => (v != null ? Binary.fromHex(v).asBytes() : v)),
    ),
    setValue$,
  ).pipe(
    withLatestFrom(encodedKey$),
    map(([value, encodedKey]) => ({ value, encodedKey })),
  ),
  null,
)

export const StorageSet: FC = () => {
  const selectedEntry = useStateObservable(selectedEntry$)
  const lookup = useStateObservable(lookup$)
  const currentValue = useStateObservable(currentValue$)
  const [isLoading, setIsLoading] = useState(false)

  if (!lookup || !selectedEntry) return null

  const shape = lookup(selectedEntry.value)
  const complexity = getTypeComplexity(shape)

  return (
    <div className="flex flex-col gap-4 items-start w-full overflow-hidden">
      <KeyDisplay />
      <StorageKeysInput disableToggle />
      {currentValue ? (
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
                const chopsticks = await firstValueFrom(chopsticksInstance$)
                if (
                  !chopsticks ||
                  !currentValue.encodedKey ||
                  !(currentValue.value instanceof Uint8Array)
                )
                  return false

                await (
                  await import("@acala-network/chopsticks-core")
                ).setStorage(chopsticks, [
                  [currentValue.encodedKey, toHex(currentValue.value)],
                ])
                await chopsticks.newBlock()
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
