import {
  InlineLookupTypeEdit,
  LookupTypeEdit,
} from "@/codec-components/LookupTypeEdit"
import { ActionButton } from "@/components/ActionButton"
import { ExpandBtn } from "@/components/Expand"
import { lookup$, metadata$ } from "@/state/chains/chain.state"
import { getTypeComplexity } from "@/utils"
import { Button } from "@polkahub/ui-components"
import { state, Subscribe, useStateObservable } from "@react-rxjs/core"
import { combineKeys, createSignal, mergeWithKey } from "@react-rxjs/utils"
import { ChevronLeft, Circle } from "lucide-react"
import { FC, useState } from "react"
import { combineLatest, defer, map, merge, scan, startWith } from "rxjs"
import { twMerge } from "tailwind-merge"

export const CustomSignedExt: FC<{ onClose: () => void }> = ({ onClose }) => {
  const metadata = useStateObservable(metadata$)

  return (
    <div className="p-2 space-y-2">
      <div className="flex items-center gap-2">
        <Button
          className="has-[>svg]:px-1"
          type="button"
          variant="ghost"
          onClick={onClose}
        >
          <ChevronLeft />
        </Button>
        <h2 className="text-lg font-bold">Custom Signed Extensions</h2>
      </div>
      <Subscribe source$={extSub$}>
        <ul className="space-y-2">
          {metadata.extrinsic.signedExtensions.map((ext) => (
            <ExtensionInput key={ext.identifier} {...ext} />
          ))}
        </ul>
      </Subscribe>
    </div>
  )
}

const [extensionValueChange$, setExtensionValue] = createSignal<{
  id: string
  part: "type" | "additionalSigned"
  value: Uint8Array | "partial" | null
}>()
const [extensionValueRemove$, clearExtension] = createSignal<string>()
const extensionValues$ = state(
  defer(() => {
    const values: Record<
      string,
      {
        type: Uint8Array | "partial" | null
        additionalSigned: Uint8Array | "partial" | null
      }
    > = {}
    return mergeWithKey({
      change: extensionValueChange$,
      remove: extensionValueRemove$,
    }).pipe(
      scan((acc, evt) => {
        const newValue = { ...acc }
        if (evt.type === "change") {
          const change = evt.payload
          newValue[change.id] ??= { type: null, additionalSigned: null }
          newValue[change.id] = {
            ...newValue[change.id],
            [change.part]: change.value,
          }
        } else {
          delete newValue[evt.payload]
        }
        return newValue
      }, values),
      startWith(values),
    )
  }),
)
export const customSignedExtensions$ = combineLatest([
  extensionValues$,
  metadata$,
  lookup$,
]).pipe(
  map(([ext, metadata, lookup]) =>
    Object.fromEntries(
      Object.entries(ext)
        .map(
          ([id, { additionalSigned, type }]): [
            string,
            {
              value?: Uint8Array
              additionalSigned?: Uint8Array
            },
          ] => {
            const ext = metadata.extrinsic.signedExtensions.find(
              (v) => v.identifier === id,
            )
            if (!ext) return [id, null!]

            const hasType = lookup(ext.type).type != "void"
            const hasAdditional = lookup(ext.additionalSigned).type != "void"

            const result: {
              value?: Uint8Array
              additionalSigned?: Uint8Array
            } = {}
            if (hasType) {
              if (type === "partial" || type == null) return [id, null!]
              result.value = type
            }
            if (hasAdditional) {
              if (additionalSigned === "partial" || additionalSigned == null)
                return [id, null!]
              result.additionalSigned = additionalSigned
            }

            return [id, result]
          },
        )
        .filter((v) => v[1] != null),
    ),
  ),
)
// Persist while app runs
extensionValues$.subscribe()

const extensionValue$ = state((id: string) =>
  extensionValues$.pipe(
    map(
      (v) =>
        v[id] as
          | {
              type: Uint8Array | "partial" | null
              additionalSigned: Uint8Array | "partial" | null
            }
          | undefined,
    ),
  ),
)
const extSub$ = merge(
  combineKeys(
    metadata$.pipe(
      map((v) => v.extrinsic.signedExtensions.map((ext) => ext.identifier)),
    ),
    extensionValue$,
  ),
  lookup$,
)

const ExtensionInput: FC<{
  identifier: string
  type: number
  additionalSigned: number
}> = ({ identifier, type, additionalSigned }) => {
  const value = useStateObservable(extensionValue$(identifier))
  const [expanded, setExpanded] = useState(!!value)
  const lookup = useStateObservable(lookup$)
  if (!lookup) return null

  const hasType = lookup(type).type != "void"
  const hasAdditional = lookup(additionalSigned).type != "void"

  if (!hasType && !hasAdditional) return null

  const getValidity = (
    value: Uint8Array<ArrayBufferLike> | "partial" | null,
  ) => (value === null ? 0 : value === "partial" ? 1 : 2)
  const typeValidity = value && hasType ? getValidity(value.type) : 2
  const additionalValidity =
    value && hasAdditional ? getValidity(value.additionalSigned) : 2
  const totalValidity = typeValidity + additionalValidity

  return (
    <li key={identifier} className="border rounded p-2 w-full">
      <div
        className={"flex items-center select-none cursor-pointer"}
        onClick={() => setExpanded((e) => !e)}
      >
        <ExpandBtn expanded={expanded} />
        <Circle
          size={8}
          strokeWidth={4}
          className={twMerge(
            "mr-1",
            totalValidity === 4
              ? "text-green-600"
              : totalValidity > 0
                ? "text-orange-600"
                : "text-red-600",
          )}
        />
        <div className="text-foreground/80">{identifier}</div>
        <div className="grow" />
        {value != null ? (
          <ActionButton
            className="py-0"
            onClick={(evt) => {
              evt.stopPropagation()
              clearExtension(identifier)
              // There's an issue when clearing fixed-sized binary inputs externally
              // And it's tough to solve without resetting the component.
              // Something we can do as a quick fix then is just colapsing the extension.
              setExpanded(false)
            }}
          >
            Clear
          </ActionButton>
        ) : null}
      </div>
      {expanded && (
        <div>
          {hasType ? (
            <div className="py-2 max-h-[60svh] overflow-hidden flex flex-col justify-stretch">
              <h3 className="text-muted-foreground font-bold">Value</h3>
              <ExtensionValueInput id={identifier} part="type" type={type} />
            </div>
          ) : null}
          {hasAdditional ? (
            <div className="py-2 max-h-[60svh] overflow-hidden flex flex-col justify-stretch">
              <h3 className="text-muted-foreground font-bold">
                Additional Signed
              </h3>
              <ExtensionValueInput
                id={identifier}
                part="additionalSigned"
                type={additionalSigned}
              />
            </div>
          ) : null}
        </div>
      )}
    </li>
  )
}

const ExtensionValueInput: FC<{
  id: string
  part: "type" | "additionalSigned"
  type: number
}> = ({ id, type, part }) => {
  const value = useStateObservable(extensionValue$(id))?.[part] ?? null
  const lookup = useStateObservable(lookup$)

  if (!lookup) return null
  const shape = lookup(type)
  const complexity = getTypeComplexity(shape)

  return complexity === "inline" ? (
    <div className="px-2">
      <InlineLookupTypeEdit
        type={type}
        value={value}
        onValueChange={(value) => setExtensionValue({ id, part, value })}
      />
    </div>
  ) : (
    <div className="py-2 max-h-[60svh] overflow-hidden flex flex-col justify-stretch">
      <LookupTypeEdit
        type={type}
        value={value}
        onValueChange={(value) => setExtensionValue({ id, part, value })}
        tree={complexity === "tree"}
      />
    </div>
  )
}
