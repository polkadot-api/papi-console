import { ActionButton } from "@/components/ActionButton"
import { useNavigate } from "@/hashParams"
import { NOTIN } from "@polkadot-api/react-builder"
import { state, useStateObservable } from "@react-rxjs/core"
import { createSignal } from "@react-rxjs/utils"
import { Enum } from "polkadot-api"
import { FC } from "react"
import { combineLatest, firstValueFrom, map } from "rxjs"
import { selectedBlock$ } from "./BlockPicker"
import { addStorageSubscription, selectedEntry$ } from "./storage.state"

const [valueChange, setValue] = createSignal<string>()
const value$ = state(valueChange, "")

const valueDecoder$ = combineLatest([selectedEntry$, selectedBlock$]).pipe(
  map(([selectedEntry, { ctx }]) =>
    selectedEntry
      ? ctx.dynamicBuilder.buildDefinition(selectedEntry.value).dec
      : null,
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
  const navigate = useNavigate()

  const submit = async () => {
    const [entry, { hash }] = await firstValueFrom(
      combineLatest([selectedEntry$, selectedBlock$]),
    )

    const id = await addStorageSubscription({
      blockHash: hash ?? null,
      pallet: entry!.pallet,
      item: entry!.entry,
      value: Enum("decode", value),
    })
    navigate(`/storage/${id}`)
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
