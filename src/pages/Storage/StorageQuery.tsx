import {
  dynamicBuilder$,
  runtimeCtx$,
  unsafeApi$,
} from "@/state/chains/chain.state"
import { EditCodec } from "@/codec-components/EditCodec"
import { ActionButton } from "@/components/ActionButton"
import { BinaryEditButton } from "@/components/BinaryEditButton"
import { CopyText } from "@/components/Copy"
import SliderToggle from "@/components/Toggle"
import {
  CodecComponentType,
  CodecComponentValue,
  NOTIN,
} from "@polkadot-api/react-builder"
import { state, useStateObservable, withDefault } from "@react-rxjs/core"
import { createSignal } from "@react-rxjs/utils"
import { Binary } from "polkadot-api"
import { FC } from "react"
import {
  combineLatest,
  filter,
  firstValueFrom,
  from,
  map,
  scan,
  startWith,
  switchMap,
} from "rxjs"
import { twMerge } from "tailwind-merge"
import {
  addStorageSubscription,
  selectedEntry$,
  stringifyArg,
} from "./storage.state"

export const StorageQuery: FC = () => {
  const selectedEntry = useStateObservable(selectedEntry$)
  const isReady = useStateObservable(isReady$)

  if (!selectedEntry) return null

  const submit = async () => {
    const [entry, unsafeApi, keyValues, keysEnabled] = await firstValueFrom(
      combineLatest([selectedEntry$, unsafeApi$, keyValues$, keysEnabled$]),
    )
    const args = keyValues.slice(0, keysEnabled)
    const storageEntry = unsafeApi.query[entry!.pallet][entry!.entry]
    const single = keyValues.length === keysEnabled
    const stream = single
      ? storageEntry.watchValue(...args)
      : from(storageEntry.getEntries(...args))

    const argString = [...args.map(stringifyArg), ...(single ? [] : ["…"])]

    addStorageSubscription({
      name: `${entry!.pallet}.${entry!.entry}(${argString})`,
      args,
      single,
      stream,
      type: entry!.value,
    })
  }

  return (
    <div className="flex flex-col gap-4 items-start w-full">
      <KeyDisplay />
      <StorageKeysInput />
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
)

const [toggleKey$, toggleKey] = createSignal<number>()
const keysEnabled$ = keys$.pipeState(
  switchMap((k) =>
    toggleKey$.pipe(
      /*
      acc=2
      [X,X, , ]
       0 1 2 3
      toggle 0 => acc=0
      toggle 1 => acc=1
      toggle 2 => acc=3
      toggle 3 => acc=4
      */
      scan((acc, toggle) => (acc <= toggle ? toggle + 1 : toggle), k.length),
      startWith(k.length),
    ),
  ),
  withDefault(0),
)

const [keyValueChange$, setKeyValue] = createSignal<{
  idx: number
  value: unknown | NOTIN
}>()
const keyValues$ = keys$.pipeState(
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
  combineLatest([keyValues$, keysEnabled$]).pipe(
    map(
      ([keyValues, keysEnabled]) =>
        keyValues.length >= keysEnabled &&
        keyValues.slice(0, keysEnabled).every((v) => v !== NOTIN),
    ),
  ),
  false,
)

const StorageKeysInput: FC = () => {
  const keys = useStateObservable(keys$)
  const keysEnabled = useStateObservable(keysEnabled$)

  return (
    <ol className="flex flex-col gap-2">
      {keys.map((type, idx) => (
        <li key={idx} className="flex flex-row gap-2 items-center">
          <SliderToggle
            isToggled={keysEnabled > idx}
            toggle={() => toggleKey(idx)}
          />
          <StorageKeyInput
            idx={idx}
            type={type}
            disabled={keysEnabled <= idx}
          />
        </li>
      ))}
    </ol>
  )
}

const builderState$ = state(
  runtimeCtx$.pipe(
    map((ctx) => ({
      ...ctx.dynamicBuilder,
      lookup: ctx.lookup,
    })),
  ),
  null,
)
const keyInputValue$ = state(
  (idx: number) =>
    keyValues$.pipe(
      map(
        (v, i): CodecComponentValue =>
          i === 0
            ? {
                type: CodecComponentType.Initial,
              }
            : {
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
              },
      ),
    ),
  {
    type: CodecComponentType.Initial,
  } satisfies CodecComponentValue,
)
const StorageKeyInput: FC<{ idx: number; type: number; disabled: boolean }> = ({
  idx,
  type,
  disabled,
}) => {
  const builder = useStateObservable(builderState$)
  const value = useStateObservable(keyInputValue$(idx))

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
        <div>{getTypeName()}</div>
        <BinaryEditButton
          initialValue={
            typeof binaryValue === "string"
              ? Binary.fromHex(binaryValue).asBytes()
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

const encodedKey$ = state(
  combineLatest([
    dynamicBuilder$,
    selectedEntry$,
    keyValues$,
    keysEnabled$,
  ]).pipe(
    map(([builder, selectedEntry, keyValues, keysEnabled]) => {
      const args = keyValues.slice(0, keysEnabled)
      if (
        keyValues.length < keysEnabled ||
        !args.every((v) => v !== NOTIN) ||
        !selectedEntry
      ) {
        return null
      }

      const codec = builder.buildStorage(
        selectedEntry.pallet,
        selectedEntry.entry,
      )
      try {
        return codec.keys.enc(...args)
      } catch (_) {
        return null
      }
    }),
  ),
  null,
)
const KeyDisplay: FC = () => {
  const key = useStateObservable(encodedKey$)
  const builder = useStateObservable(builderState$)
  const selectedEntry = useStateObservable(selectedEntry$)
  const keys = useStateObservable(keys$)
  const keysEnabled = useStateObservable(keysEnabled$)

  if (!builder || !selectedEntry) return null

  const codec = builder.buildStorage(selectedEntry.pallet, selectedEntry.entry)

  return (
    <div className="flex w-full overflow-hidden border border-card-foreground/60 px-3 p-2 gap-2 items-center bg-card text-card-foreground">
      <div className="shrink-0 text-sm font-bold">Encoded key:</div>
      <div
        className={twMerge(
          "flex-1 overflow-hidden whitespace-nowrap text-ellipsis text-sm tabular-nums",
          key === null ? "text-card-foreground/60" : null,
        )}
      >
        {key ?? "Fill in all the storage keys to calculate the encoded key"}
      </div>
      <CopyText text={key ?? ""} disabled={key === null} binary />
      {keys.length === keysEnabled && (
        <BinaryEditButton
          initialValue={key ? Binary.fromHex(key).asBytes() : undefined}
          onValueChange={(value: unknown[]) => {
            value.forEach((value, idx) => setKeyValue({ idx, value }))
          }}
          decode={(v) =>
            codec.keys.dec(
              typeof v === "string" ? v : Binary.fromBytes(v).asHex(),
            )
          }
        />
      )}
    </div>
  )
}
