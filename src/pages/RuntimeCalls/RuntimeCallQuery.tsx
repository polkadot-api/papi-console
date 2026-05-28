import {
  InlineLookupTypeEdit,
  LookupTypeEdit,
} from "@/codec-components/LookupTypeEdit"
import { ActionButton } from "@/components/ActionButton"
import { ExpandBtn } from "@/components/Expand"
import { useNavigate } from "@/hashParams"
import { client$, dynamicBuilder$, lookup$ } from "@/state/chains/chain.state"
import { getTypeComplexity } from "@/utils/shape"
import { state, useStateObservable, withDefault } from "@react-rxjs/core"
import { createSignal } from "@react-rxjs/utils"
import { Circle, Dot } from "lucide-react"
import { FC, useState } from "react"
import {
  combineLatest,
  distinctUntilChanged,
  filter,
  firstValueFrom,
  map,
  scan,
  startWith,
  switchMap,
} from "rxjs"
import { twMerge } from "tailwind-merge"
import { selectedBlock$ } from "../Storage/BlockPicker"
import {
  addRuntimeCallQuery,
  runtimeCallEntryState,
} from "./runtimeCalls.state"

export const RuntimeCallQuery: FC = () => {
  const selectedEntry = useStateObservable(runtimeCallEntryState.selectedEntry$)
  const isReady = useStateObservable(isReady$)
  const navigate = useNavigate()

  if (!selectedEntry) return null

  const submit = async () => {
    const [entry, inputValues, builder, block] = await firstValueFrom(
      combineLatest([
        runtimeCallEntryState.selectedEntry$,
        inputValues$,
        dynamicBuilder$,
        selectedBlock$.pipe(
          switchMap((block) =>
            block.hash
              ? [
                  {
                    latest: false,
                    hash: block.hash,
                  },
                ]
              : client$.pipe(
                  switchMap((client) => client.finalizedBlock$),
                  map((v) => ({
                    latest: true,
                    hash: v.hash,
                  })),
                ),
          ),
        ),
      ]),
    )
    const decodedValues = inputValues.map((v, i) =>
      builder
        .buildDefinition(selectedEntry.inputs[i].type)
        .dec(v as Uint8Array),
    )

    const id = await addRuntimeCallQuery({
      latestBlock: block.latest,
      blockHash: block.hash,
      api: entry!.api,
      method: entry!.name,
      args: decodedValues,
    })
    navigate(`/runtimeCalls/${id}`)
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

export const [inputValueChange$, setInputValue] = createSignal<{
  idx: number
  value: Uint8Array | "partial" | null
}>()
const inputValues$ = runtimeCallEntryState.selectedEntry$.pipeState(
  filter((v) => !!v),
  map((v) => v.inputs),
  distinctUntilChanged(
    (a, b) => a.length === b.length && a.every((v, i) => b[i].type === v.type),
  ),
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
  const selectedEntry = useStateObservable(runtimeCallEntryState.selectedEntry$)
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
