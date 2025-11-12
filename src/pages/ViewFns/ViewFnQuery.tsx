import {
  dynamicBuilder$,
  lookup$,
  unsafeApi$,
} from "@/state/chains/chain.state"
import {
  InlineLookupTypeEdit,
  LookupTypeEdit,
} from "@/codec-components/LookupTypeEdit"
import { ActionButton } from "@/components/ActionButton"
import { ExpandBtn } from "@/components/Expand"
import { getTypeComplexity } from "@/utils/shape"
import { state, useStateObservable, withDefault } from "@react-rxjs/core"
import { createSignal } from "@react-rxjs/utils"
import { Circle, Dot } from "lucide-react"
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
import { twMerge } from "tailwind-merge"
import { addViewFnCall, selectedEntry$ } from "./viewFns.state"

export const ViewFnQuery: FC = () => {
  const selectedEntry = useStateObservable(selectedEntry$)
  const isReady = useStateObservable(isReady$)

  if (!selectedEntry) return null

  const submit = async () => {
    const [entry, unsafeApi, inputValues, builder] = await firstValueFrom(
      combineLatest([
        selectedEntry$,
        unsafeApi$,
        inputValues$,
        dynamicBuilder$,
      ]),
    )
    const decodedValues = inputValues.map((v, i) =>
      builder
        .buildDefinition(selectedEntry.inputs[i].type)
        .dec(v as Uint8Array),
    )
    const promise = unsafeApi.view[entry!.pallet][entry!.name](...decodedValues)

    addViewFnCall({
      name: `${entry!.pallet}.${entry!.name}(…)`,
      promise,
      type: entry!.output,
    })
  }

  return (
    <div className="flex flex-col gap-4 items-start w-full">
      <ViewFnInputValues />
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

const ViewFnInputValues: FC = () => {
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
const lookupState$ = state(lookup$, null)
const RuntimeValueInput: FC<{ idx: number; name: string; type: number }> = ({
  idx,
  type,
  name,
}) => {
  const value = useStateObservable(inputValue$(idx))
  const [expanded, setExpanded] = useState(false)
  const lookup = useStateObservable(lookupState$)

  if (!lookup) return null
  const shape = lookup(type)
  const complexity = getTypeComplexity(shape)

  return (
    <li key={idx} className="border rounded p-2 w-full">
      <div
        className={twMerge(
          "flex items-center select-none",
          complexity !== "inline" && "cursor-pointer",
        )}
        onClick={() => setExpanded((e) => !e)}
      >
        {complexity === "inline" ? (
          <Dot size={16} />
        ) : (
          <ExpandBtn expanded={expanded} />
        )}
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
        <div className="text-foreground/80">{name}</div>
        {complexity === "inline" ? (
          <div className="px-2">
            <InlineLookupTypeEdit
              type={type}
              value={value}
              onValueChange={(value) => setInputValue({ idx, value })}
            />
          </div>
        ) : null}
      </div>
      {expanded && complexity !== "inline" && (
        <div className="py-2 max-h-[60svh] overflow-hidden flex flex-col justify-stretch">
          <LookupTypeEdit
            type={type}
            value={value}
            onValueChange={(value) => setInputValue({ idx, value })}
            tree={complexity === "tree"}
          />
        </div>
      )}
    </li>
  )
}
