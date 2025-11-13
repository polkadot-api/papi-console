import { ActionButton } from "@/components/ActionButton"
import { dynamicBuilder$ } from "@/state/chains/chain.state"
import { NOTIN } from "@polkadot-api/react-builder"
import { state, useStateObservable } from "@react-rxjs/core"
import { createSignal } from "@react-rxjs/utils"
import { FC } from "react"
import { combineLatest, firstValueFrom, map } from "rxjs"
import { addStorageSubscription, selectedEntry$ } from "./storage.state"

const [valueChange, setValue] = createSignal<string>()
const value$ = state(valueChange, "")

const valueDecoder$ = combineLatest([selectedEntry$, dynamicBuilder$]).pipe(
  map(([selectedEntry, builder]) =>
    selectedEntry ? builder.buildDefinition(selectedEntry.value).dec : null,
  ),
)
const decodedValue$ = state(
  combineLatest([value$, valueDecoder$]).pipe(
    map(([value, decoder]) => {
      if (!decoder) return NOTIN
      try {
        return decoder(value)
      } catch (_) {
        return NOTIN
      }
    }),
  ),
  NOTIN,
)

export const StorageDecode: FC = () => {
  const value = useStateObservable(value$)
  const decoded = useStateObservable(decodedValue$)

  const submit = async () => {
    const entry = await firstValueFrom(selectedEntry$)

    addStorageSubscription({
      name: `${entry!.pallet}.${entry!.entry}(…)`,
      args: null,
      single: true,
      value: decoded,
      type: entry!.value,
    })
  }

  return (
    <div className="w-full">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-full bg-polkadot-100 p-2 rounded tabular-nums text-polkadot-800"
        placeholder="Enter hex …"
      />
      <ActionButton disabled={decoded === NOTIN} onClick={submit}>
        Decode
      </ActionButton>
    </div>
  )
}
