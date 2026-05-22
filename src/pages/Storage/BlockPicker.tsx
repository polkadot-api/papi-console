import { Spinner } from "@/components/Icons"
import { blockHash$ } from "@/state/block.state"
import {
  CachedRuntime,
  runtimeCtx$,
  runtimeCtxAt$,
} from "@/state/chains/chain.state"
import { Input } from "@polkahub/ui-components"
import {
  liftSuspense,
  state,
  SUSPENSE,
  useStateObservable,
} from "@react-rxjs/core"
import { createSignal } from "@react-rxjs/utils"
import { Check, X } from "lucide-react"
import {
  catchError,
  debounceTime,
  filter,
  map,
  Observable,
  startWith,
  switchMap,
} from "rxjs"

const [valueChange$, setValue] = createSignal<string>()
const inputValue$ = state(valueChange$, "Latest")

export const setBlockHashValue = setValue
const loadedCtx$ = state(
  inputValue$.pipe(
    debounceTime(200),
    switchMap((v) => {
      const inner$: Observable<{
        ctx: CachedRuntime
        hash?: string
      }> =
        !v.trim() || v === "Latest"
          ? runtimeCtx$.pipe(map((ctx) => ({ ctx })))
          : blockHash$(v).pipe(
              switchMap((hash) =>
                runtimeCtxAt$(hash).pipe(map((ctx) => ({ ctx, hash }))),
              ),
            )

      return inner$.pipe(
        liftSuspense(),
        map((value) =>
          value === SUSPENSE
            ? {
                type: "loading" as const,
              }
            : {
                type: "success" as const,
                value,
              },
        ),
        catchError((value) => [
          {
            type: "error" as const,
            value,
          },
        ]),
        startWith({
          type: "loading" as const,
        }),
      )
    }),
  ),
  { type: "loading" as const },
)

export const selectedBlock$ = loadedCtx$.pipeState(
  filter((v) => v.type === "success"),
  map((v) => v.value),
)

export const BlockPicker = () => {
  const value = useStateObservable(inputValue$)
  const loadedCtx = useStateObservable(loadedCtx$)

  return (
    <div className="flex items-center">
      <Input
        className="bg-input max-w-52"
        placeholder="Block hash or number"
        value={value}
        onChange={(evt) => setValue(evt.target.value)}
        onFocus={() => {
          if (value === "Latest") {
            setValue("")
          }
        }}
        onBlur={() => {
          if (!value.trim()) {
            setValue("Latest")
          }
        }}
      />
      {loadedCtx.type === "loading" ? (
        <Spinner className="text-muted-foreground" />
      ) : loadedCtx.type === "error" ? (
        <X className="text-red-500" />
      ) : (
        <Check className="text-green-600" />
      )}
    </div>
  )
}
