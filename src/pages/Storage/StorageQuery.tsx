import { EditCodec } from "@/codec-components/EditCodec"
import { ActionButton } from "@/components/ActionButton"
import { BinaryEditButton } from "@/components/BinaryEditButton"
import { CopyText } from "@/components/Copy"
import SliderToggle from "@/components/Toggle"
import {
  dynamicBuilder$,
  runtimeCtx$,
  unsafeApi$,
} from "@/state/chains/chain.state"
import {
  CodecComponentType,
  CodecComponentValue,
  NOTIN,
} from "@polkadot-api/react-builder"
import { Twox128 } from "@polkadot-api/substrate-bindings"
import { toHex } from "@polkadot-api/utils"
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
  ObservedValueOf,
  scan,
  startWith,
  switchMap,
  withLatestFrom,
} from "rxjs"
import { twMerge } from "tailwind-merge"
import {
  addStorageSubscription,
  selectedEntry$,
  selectEntry,
  stringifyArg,
} from "./storage.state"

export const StorageQuery: FC = () => {
  const selectedEntry = useStateObservable(selectedEntry$)
  const isReady = useStateObservable(isReady$)

  if (!selectedEntry) return null

  const submit = async () => {
    const [entry, unsafeApi, keyValues, keysEnabled, keyCodec] =
      await firstValueFrom(
        combineLatest([
          selectedEntry$,
          unsafeApi$,
          keyValues$,
          keysEnabled$,
          keyCodec$,
        ]),
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
      keyCodec: keyCodec!,
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

const hashers$ = selectedEntry$.pipeState(
  filter((e) => !!e),
  map((entry) => entry.hashers),
  withDefault([] as string[]),
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
  combineLatest([keyValues$, keysEnabled$]).pipe(
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
  const keysEnabled = useStateObservable(keysEnabled$)

  return (
    <ol className="flex flex-col gap-2">
      {keys.map((type, idx) => (
        <li key={idx} className="flex flex-row gap-2 items-center">
          {disableToggle ? null : (
            <SliderToggle
              isToggled={keysEnabled > idx}
              toggle={() => toggleKey(idx)}
            />
          )}
          <StorageKeyInput
            idx={idx}
            hasher={hashers[idx]}
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
const keysCodec$ = combineLatest([keys$, builderState$]).pipe(
  map(([keys, builder]) => keys.map((type) => builder?.buildDefinition(type))),
)
const keyInputValue$ = state(
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
const StorageKeyInput: FC<{
  idx: number
  type: number
  disabled: boolean
  hasher: string
}> = ({ idx, type, disabled, hasher }) => {
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
        <div>
          {getTypeName()} ({hasher})
        </div>
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

const keyCodec$ = state(
  combineLatest([dynamicBuilder$, selectedEntry$]).pipe(
    map(([builder, selectedEntry]) =>
      selectedEntry
        ? builder.buildStorage(selectedEntry.pallet, selectedEntry.entry).keys
        : null,
    ),
  ),
)

export const encodedKey$ = state(
  combineLatest([keyCodec$, keyValues$, keysEnabled$]).pipe(
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

export const KeyDisplay: FC = () => {
  const key = useStateObservable(encodedKey$)
  const builder = useStateObservable(builderState$)
  const selectedEntry = useStateObservable(selectedEntry$)
  const keysEnabled = useStateObservable(keysEnabled$)

  if (!builder || !selectedEntry) return null

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
      <BinaryEditButton
        initialValue={key ? Binary.fromHex(key).asBytes() : undefined}
        onValueChange={(value: NonNullable<DecodedKey>) => {
          let newKeysEnabled = keysEnabled
          if (
            value.pallet.name !== selectedEntry.pallet ||
            value.item.name !== selectedEntry.entry
          ) {
            selectEntry({
              pallet: value.pallet.name,
              entry: value.item.name,
            })
            newKeysEnabled =
              value.item.type.tag === "plain"
                ? 0
                : value.item.type.value.hashers.length
          }

          if (value.args.length !== newKeysEnabled) {
            if (value.args.length > newKeysEnabled) {
              toggleKey(value.args.length - 1)
            } else {
              toggleKey(value.args.length)
            }
          }

          value.args.forEach((value, idx) =>
            setKeyValue({
              idx,
              value,
            }),
          )
        }}
        decode={(v) => {
          const decoded = decodeKey(builder, v)
          if (!decoded) throw null
          return decoded
        }}
      />
    </div>
  )
}

const textEncoder = new TextEncoder()
const hashersToLength: Record<string, number> = {
  Identity: 0,
  Twox64Concat: 8,
  Blake2128Concat: 16,
  Blake2128: -16,
  Blake2256: -32,
  Twox128: -16,
  Twox256: -32,
}

const decodeKey = (
  builder: NonNullable<ObservedValueOf<typeof builderState$>>,
  key: Uint8Array,
) => {
  const twoxHash = (v: string) => toHex(Twox128(textEncoder.encode(v)))

  const keyHex = toHex(key)
  const pallet = builder.lookup.metadata.pallets.find(
    (p) => p.storage && keyHex.startsWith(twoxHash(p.storage.prefix)),
  )
  if (!pallet) return null

  const keyRemaining = keyHex.replace(twoxHash(pallet.storage!.prefix), "0x")
  const item = pallet.storage!.items.find((v) =>
    keyRemaining.startsWith(twoxHash(v.name)),
  )
  if (!item) return null

  const codec = builder.buildStorage(pallet.name, item.name)
  const hasherLengths =
    item.type.tag === "plain"
      ? []
      : item.type.value.hashers.map((x) => hashersToLength[x.tag])

  let argsRemaining = Binary.fromHex(
    keyRemaining.replace(twoxHash(item.name), "0x"),
  ).asBytes()

  const args: any[] = []
  const argsLen = codec.args.inner.length
  for (let i = 0; i < argsLen && argsRemaining.length; i++) {
    const hashLength = hasherLengths[i]

    if (argsRemaining.length < Math.abs(hashLength)) return null
    argsRemaining = argsRemaining.slice(Math.abs(hashLength))

    if (hashLength < 0) {
      // Signals a non-reversible hasher
      args.push(null)
    } else {
      const argCodec = codec.args.inner[i]
      try {
        const value = argCodec.dec(argsRemaining)
        // This is needed not just for the length, but see case AccountId: Can decode 0x, but then can't re-encode back. <- TODO bug?
        const reEnc = argCodec.enc(value)
        argsRemaining = argsRemaining.slice(reEnc.length)
        args.push(value)
      } catch {
        return null
      }
    }
  }

  return {
    pallet,
    item,
    args,
  }
}
type DecodedKey = ReturnType<typeof decodeKey>
