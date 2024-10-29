import { lookup$, unsafeApi$ } from "@/chain.state"
import { LookupTypeEdit } from "@/codec-components/LookupTypeEdit"
import { ActionButton } from "@/components/ActionButton"
import { ExpandBtn } from "@/components/Expand"
import { getDynamicBuilder } from "@polkadot-api/metadata-builders"
import { state, useStateObservable, withDefault } from "@react-rxjs/core"
import { createSignal } from "@react-rxjs/utils"
import { FC, useState } from "react"
import {
  combineLatest,
  filter,
  firstValueFrom,
  map,
  scan,
  startWith,
  switchMap,
} from "rxjs"
import { addRuntimeCallQuery, selectedEntry$ } from "./runtimeCalls.state"
import { Circle } from "lucide-react"
import { twMerge } from "tailwind-merge"

export const RuntimeCallQuery: FC = () => {
  const selectedEntry = useStateObservable(selectedEntry$)
  const isReady = useStateObservable(isReady$)

  if (!selectedEntry) return null

  const submit = async () => {
    const [entry, unsafeApi, inputValues, builder] = await firstValueFrom(
      combineLatest([
        selectedEntry$,
        unsafeApi$,
        inputValues$,
        lookup$.pipe(map(getDynamicBuilder)),
      ]),
    )
    const decodedValues = inputValues.map((v, i) =>
      builder
        .buildDefinition(selectedEntry.inputs[i].type)
        .dec(v as Uint8Array),
    )
    const promise = unsafeApi.apis[entry!.api][entry!.name](...decodedValues)

    addRuntimeCallQuery({
      name: `${entry!.api}.${entry!.name}(…)`,
      promise,
      type: entry!.output,
    })
  }

  return (
    <div className="flex flex-col gap-4 items-start w-full">
      <RuntimeInputValues />
      <ActionButton disabled={!isReady} onClick={submit}>
        Call
      </ActionButton>
    </div>
  )
}

const [inputValueChange$, setInputValue] = createSignal<{
  idx: number
  value: Uint8Array | "partial" | null
}>()
const inputValues$ = selectedEntry$.pipeState(
  filter((v) => !!v),
  map((v) => v.inputs),
  switchMap((inputs) => {
    const values: Array<Uint8Array | "partial" | null> = inputs.map(() => null)
    return inputValueChange$.pipe(
      scan((acc, change) => {
        const newValue = [...acc]
        newValue[change.idx] = change.value
        return newValue
      }, values),
      startWith(values),
    )
  }),
  withDefault([] as Array<Uint8Array | "partial" | null>),
)

const isReady$ = inputValues$.pipeState(
  map((inputValues) => inputValues.every((v) => v instanceof Uint8Array)),
  withDefault(false),
)

const RuntimeInputValues: FC = () => {
  const selectedEntry = useStateObservable(selectedEntry$)
  if (!selectedEntry || !selectedEntry.inputs.length) return null

  return (
    <div className="w-full">
      Inputs
      <ol className="flex flex-col gap-2">
        {selectedEntry.inputs.map((input, idx) => (
          <RuntimeValueInput
            key={idx}
            idx={idx}
            name={input.name}
            type={input.type}
          />
        ))}
      </ol>
    </div>
  )
}

const inputValue$ = state(
  (idx: number) => inputValues$.pipe(map((v) => v[idx])),
  null,
)
const RuntimeValueInput: FC<{ idx: number; name: string; type: number }> = ({
  idx,
  type,
  name,
}) => {
  const value = useStateObservable(inputValue$(idx))
  const [expanded, setExpanded] = useState(false)

  return (
    <li key={idx} className="border rounded p-2 w-full">
      <div
        className="flex items-center cursor-pointer select-none"
        onClick={() => setExpanded((e) => !e)}
      >
        <ExpandBtn expanded={expanded} />
        <Circle
          size={8}
          strokeWidth={4}
          className={twMerge(
            "mr-1",
            value === null
              ? "text-red-600"
              : value === "partial"
                ? "text-orange-600"
                : "text-green-600",
          )}
        />
        <div className="text-polkadot-200">{name}</div>
      </div>
      {expanded && (
        <div className="py-2 max-h-[60svh] overflow-hidden flex">
          <LookupTypeEdit
            type={type}
            value={value}
            onValueChange={(value) => setInputValue({ idx, value })}
          />
        </div>
      )}
    </li>
  )
}
