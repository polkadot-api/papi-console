import { EditCodec } from "@/codec-components/EditCodec"
import { ActionButton } from "@/components/ActionButton"
import { BinaryEditButton } from "@/components/BinaryEditButton"
import SliderToggle from "@/components/Toggle"
import { useNavigate } from "@/hashParams"
import {
  CodecComponentType,
  CodecComponentValue,
  NOTIN,
} from "@polkadot-api/react-builder"
import { Input } from "@polkahub/ui-components"
import { state, useStateObservable, withDefault } from "@react-rxjs/core"
import { createSignal, mergeWithKey } from "@react-rxjs/utils"
import { Binary, Enum } from "polkadot-api"
import { fromHex } from "polkadot-api/utils"
import { ChangeEvent, FC } from "react"
import {
  combineLatest,
  distinctUntilChanged,
  filter,
  firstValueFrom,
  map,
  merge,
  scan,
  startWith,
  switchMap,
  withLatestFrom,
} from "rxjs"
import { twMerge } from "tailwind-merge"
import { selectedBlock$ } from "./BlockPicker"
import { decodeKey } from "./decodeKey"
import {
  addStorageSubscription,
  selectedEntry$,
  selectEntry,
} from "./storage.state"
import { StorageEntryPicker } from "./StorageEntryPicker"

export const StorageQuery: FC = () => {
  const isReady = useStateObservable(isReady$)
  const navigate = useNavigate()

  const submit = async () => {
    const [entry, keyValues, keysEnabled, { hash }] = await firstValueFrom(
      combineLatest([selectedEntry$, keyValues$, argsEnabled$, selectedBlock$]),
    )
    const args = keyValues.slice(0, keysEnabled)

    const id = await addStorageSubscription({
      blockHash: hash ?? null,
      pallet: entry!.pallet,
      item: entry!.entry,
      value: Enum("query", args),
    })
    navigate(`/storage/${id}`)
  }

  return (
    <div className="flex flex-col gap-4 items-start w-full">
      <StorageEntryPicker />
      <StorageKeysInput />
      <KeyInput />
      <ActionButton disabled={!isReady} onClick={submit}>
        Query
      </ActionButton>
    </div>
  )
}

const keys$ = selectedEntry$.pipeState(
  filter((e) => !!e),
  map((entry) => entry.key),
  withDefault([] as number[]),
  distinctUntilChanged((a, b) => a.join(",") === b.join(",")),
)

const hashers$ = selectedEntry$.pipeState(
  filter((e) => !!e),
  map((entry) => entry.hashers),
  withDefault([] as string[]),
)

const [toggleKey$, toggleKey] = createSignal<number>()
export const [changeKeysEnabled$, setKeysEnabled] = createSignal<number>()
const argsEnabled$ = keys$.pipeState(
  switchMap((k) =>
    mergeWithKey({
      toggle: toggleKey$,
      set: changeKeysEnabled$,
    }).pipe(
      /*
      acc=2
      [X,X, , ]
       0 1 2 3
      toggle 0 => acc=0
      toggle 1 => acc=1
      toggle 2 => acc=3
      toggle 3 => acc=4
      */
      scan(
        (acc, evt) =>
          evt.type === "set" || acc > evt.payload
            ? evt.payload
            : evt.payload + 1,
        k.length,
      ),
      startWith(k.length),
    ),
  ),
  withDefault(0),
)

export const [keyValueChange$, setKeyValue] = createSignal<{
  idx: number
  value: unknown | NOTIN
}>()
export const keyValues$ = keys$.pipeState(
  switchMap((keys) => {
    const values: unknown[] = keys.map(() => NOTIN)
    return keyValueChange$.pipe(
      scan((acc, change) => {
        const newValue = [...acc]
        newValue[change.idx] = change.value
        return newValue
      }, values),
      startWith(values),
    )
  }),
  withDefault([] as unknown[]),
)

const isReady$ = state(
  combineLatest([keyValues$, argsEnabled$]).pipe(
    map(
      ([keyValues, keysEnabled]) =>
        keyValues.length >= keysEnabled &&
        keyValues.slice(0, keysEnabled).every((v) => v !== NOTIN),
    ),
  ),
  false,
)

export const StorageKeysInput: FC<{
  disableToggle?: boolean
}> = ({ disableToggle }) => {
  const keys = useStateObservable(keys$)
  const hashers = useStateObservable(hashers$)
  const argsEnabled = useStateObservable(argsEnabled$)

  return (
    <div>
      <label>Params</label>
      <ol className="flex flex-col gap-2">
        {keys.map((type, idx) => (
          <li key={idx} className="flex flex-row gap-2 items-center">
            {disableToggle ? null : (
              <SliderToggle
                isToggled={argsEnabled > idx}
                toggle={() => toggleKey(idx)}
              />
            )}
            <StorageArgInput
              idx={idx}
              hasher={hashers[idx]}
              type={type}
              disabled={argsEnabled <= idx}
            />
          </li>
        ))}
      </ol>
    </div>
  )
}

const builderState$ = state(
  selectedBlock$.pipe(
    map(({ ctx }) => ({
      ...ctx.dynamicBuilder,
      lookup: ctx.lookup,
    })),
  ),
  null,
)
const keysCodec$ = combineLatest([keys$, builderState$]).pipe(
  map(([keys, builder]) => keys.map((type) => builder?.buildDefinition(type))),
)
const argInputValue$ = state(
  (idx: number) =>
    keyValues$.pipe(
      withLatestFrom(keysCodec$),
      map(([v, codecs], i): CodecComponentValue => {
        if (i === 0) {
          try {
            return {
              type: CodecComponentType.Initial,
              value: codecs[idx]?.enc(v[idx]),
            }
          } catch {
            return {
              type: CodecComponentType.Initial,
            }
          }
        }

        return {
          type: CodecComponentType.Updated,
          value:
            v[idx] === NOTIN
              ? {
                  empty: true,
                }
              : {
                  empty: false,
                  decoded: v[idx],
                },
        }
      }),
    ),
  {
    type: CodecComponentType.Initial,
  } satisfies CodecComponentValue,
)
const StorageArgInput: FC<{
  idx: number
  type: number
  disabled: boolean
  hasher: string
}> = ({ idx, type, disabled, hasher }) => {
  const builder = useStateObservable(builderState$)
  const value = useStateObservable(argInputValue$(idx))

  if (!builder) return null

  const codec = builder.buildDefinition(type)
  const getBinValue = () => {
    try {
      return (
        (value.type === CodecComponentType.Initial
          ? value.value
          : value.value.empty
            ? null
            : (value.value.encoded ?? codec.enc(value.value.decoded))) ?? null
      )
    } catch (ex) {
      console.error(ex)
    }
  }
  const binaryValue = getBinValue()

  const getTypeName = () => {
    const lookupEntry = builder.lookup(type)
    switch (lookupEntry.type) {
      case "primitive":
        return lookupEntry.value
      case "compact":
        return lookupEntry.size
      case "enum":
        return "Enum"
      case "array":
        if (
          lookupEntry.value.type === "primitive" &&
          lookupEntry.value.value === "u8"
        ) {
          return "Binary"
        }
        return null
      case "bitSequence":
      case "AccountId20":
      case "AccountId32":
        return lookupEntry.type
      default:
        return null
    }
  }

  return (
    <div
      className={twMerge(
        "border-l px-2",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      <div className="flex justify-between">
        <div>
          {getTypeName()} ({hasher})
        </div>
        <BinaryEditButton
          initialValue={
            typeof binaryValue === "string"
              ? fromHex(binaryValue)
              : (binaryValue ?? undefined)
          }
          onValueChange={(value) => setKeyValue({ idx, value })}
          decode={codec.dec}
        />
      </div>
      <EditCodec
        metadata={builder.lookup.metadata}
        codecType={type}
        value={value}
        onUpdate={(value) =>
          setKeyValue({ idx, value: value.empty ? NOTIN : value.decoded })
        }
      />
    </div>
  )
}

const keyCodec$ = state(
  combineLatest([selectedBlock$, selectedEntry$]).pipe(
    map(([{ ctx }, selectedEntry]) =>
      selectedEntry
        ? ctx.dynamicBuilder.buildStorage(
            selectedEntry.pallet,
            selectedEntry.entry,
          ).keys
        : null,
    ),
  ),
)

export const encodedKey$ = state(
  combineLatest([keyCodec$, keyValues$, argsEnabled$]).pipe(
    map(([codec, keyValues, keysEnabled]) => {
      const args = keyValues.slice(0, keysEnabled)
      if (
        keyValues.length < keysEnabled ||
        !args.every((v) => v !== NOTIN) ||
        !codec
      ) {
        return null
      }

      try {
        return codec.enc(...args)
      } catch (_) {
        return null
      }
    }),
  ),
  null,
)

const [keyInputChange$, onKeyInputChange] =
  createSignal<ChangeEvent<HTMLInputElement>>()
const [keyInputBlur$, onKeyInputBlur] = createSignal<void>()
const keyInput$ = state(
  merge(
    keyInputChange$.pipe(
      map((v) => v.currentTarget.value),
      withLatestFrom(selectedBlock$.pipe(map((v) => v.ctx))),
      map(([value, ctx]) => {
        const error =
          value.length > 3 &&
          (() => {
            try {
              return !decodeKey(ctx, Binary.fromHex(value))
            } catch {
              return true
            }
          })()

        return { value, error }
      }),
    ),
    merge(encodedKey$, keyInputBlur$.pipe(switchMap(() => encodedKey$))).pipe(
      map((value) => ({ value: value ?? "", error: false })),
    ),
  ),
  {
    value: "",
    error: false,
  },
)

export const KeyInput: FC = () => {
  const keyInput = useStateObservable(keyInput$)
  const builder = useStateObservable(builderState$)
  const selectedEntry = useStateObservable(selectedEntry$)
  const keysEnabled = useStateObservable(argsEnabled$)

  if (!builder || !selectedEntry) return null

  return (
    <div className="w-full">
      <label>Encoded key</label>
      <Input
        type="text"
        className={twMerge(
          "min-w-0 w-full tabular-nums text-muted-foreground",
          keyInput.error && "text-red-600",
        )}
        placeholder="Fill in all the storage keys to calculate the encoded key"
        value={keyInput.value}
        onChange={onKeyInputChange}
        onBlur={() => {
          onKeyInputBlur()

          try {
            const decoded = decodeKey(
              {
                dynamicBuilder: builder,
                lookup: builder.lookup,
              },
              Binary.fromHex(keyInput.value),
            )
            if (!decoded) return

            let newKeysEnabled = keysEnabled
            if (
              decoded.pallet.name !== selectedEntry.pallet ||
              decoded.item.name !== selectedEntry.entry
            ) {
              selectEntry({
                pallet: decoded.pallet.name,
                entry: decoded.item.name,
              })
              newKeysEnabled =
                decoded.item.type.tag === "plain"
                  ? 0
                  : decoded.item.type.value.hashers.length
            }

            if (decoded.args.length !== newKeysEnabled) {
              if (decoded.args.length > newKeysEnabled) {
                toggleKey(decoded.args.length - 1)
              } else {
                toggleKey(decoded.args.length)
              }
            }

            decoded.args.forEach((value, idx) =>
              setKeyValue({
                idx,
                value,
              }),
            )
          } catch {
            return
          }
        }}
      />
    </div>
  )
}
