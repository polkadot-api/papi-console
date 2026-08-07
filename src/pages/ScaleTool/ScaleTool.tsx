import { EditCodec } from "@/codec-components/EditCodec"
import { BinaryDisplay } from "@/codec-components/LookupTypeEdit/BinaryDisplay"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { getHashParams } from "@/hashParams"
import {
  getDynamicBuilder,
  getLookupFn,
  MetadataLookup,
} from "@polkadot-api/metadata-builders"
import {
  CodecComponentType,
  CodecComponentValue,
} from "@polkadot-api/react-builder"
import { Binary, unifyMetadata } from "@polkadot-api/substrate-bindings"
import {
  BinaryIcon,
  BookOpenText,
  Braces,
  CheckCircle2,
  CircleAlert,
  Link2,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useLocation } from "react-router-dom"
import { CenteredScrollContainer } from "../AppShell"
import { textToMetadata } from "./textToMetadata"
import { decodeTypeParam, encodeTypeParam } from "./typeParam"

const initialType = `{
  compactValue: compact,
  variant: Enum {
    SomeType: u8,
    AnotherType: Vec<{
      tuple: [u8, i16],
      boolean: bool
    }>
  }
}`

export const ScaleTool = () => (
  <CenteredScrollContainer className="max-w-none p-4 @3xl:p-6 flex flex-col gap-5 overflow-auto">
    <header className="flex flex-col gap-3 @3xl:flex-row @3xl:items-end @3xl:justify-between">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">SCALE tool</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Define any portable type, then encode structured values or decode
          SCALE-encoded bytes against it.
        </p>
      </div>
      <div className="flex w-fit items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground shadow-xs">
        <Link2 className="size-3.5" aria-hidden="true" />
        Type and data stay in the URL for sharing
      </div>
    </header>
    <TypeTool />
  </CenteredScrollContainer>
)

const TypeTool = () => {
  const [definition, setDefinition] = useFragmentParamState(
    "type",
    initialType,
    encodeTypeParam,
    decodeTypeParam,
  )
  const [data, setData] = useFragmentParamState("data", null)
  const [lookup, setLookup] = useState<MetadataLookup | null>(null)
  const [error, setError] = useState("")
  const [componentValue, setComponentValue] = useState<CodecComponentValue>({
    type: CodecComponentType.Initial,
    value: data ?? "",
  })
  const componentValueRef = useRef(componentValue)
  componentValueRef.current = componentValue

  useEffect(() => {
    // Ensure a fresh tool URL is immediately self-contained and shareable.
    setDefinition(definition)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    try {
      const nextLookup = getLookupFn(unifyMetadata(textToMetadata(definition)))
      const nextCodec = getDynamicBuilder(nextLookup).buildDefinition(0)
      const currentValue = componentValueRef.current

      try {
        if (currentValue.type === CodecComponentType.Initial) {
          if (currentValue.value) nextCodec.dec(currentValue.value)
        } else if (!currentValue.value.empty) {
          const previousDecoded = currentValue.value.decoded
          const nextValue = codecValueCandidates(previousDecoded)
            .map((candidate) => {
              try {
                const encoded = nextCodec.enc(candidate)
                return { encoded, decoded: nextCodec.dec(encoded) }
              } catch {
                return null
              }
            })
            .find(
              (value) =>
                value && codecValuesEqual(value.decoded, previousDecoded),
            )
          if (!nextValue) {
            throw new Error("The value is not compatible with the new type")
          }
          setComponentValue({
            type: CodecComponentType.Updated,
            value: { ...currentValue.value, ...nextValue },
          })
        }
      } catch {
        setComponentValue({ type: CodecComponentType.Initial, value: "" })
        setData(null)
      }

      setLookup(() => nextLookup)
      setError("")
    } catch (error) {
      setLookup(null)
      setError(error instanceof Error ? error.message : String(error))
    }
  }, [definition, setData])

  const builder = useMemo(
    () => (lookup ? getDynamicBuilder(lookup) : null),
    [lookup],
  )
  const codec = builder?.buildDefinition(0)

  useEffect(() => {
    const nextValue = data ?? ""
    const currentValue =
      componentValue.type === CodecComponentType.Initial
        ? componentValue.value
        : componentValue.value.empty
          ? ""
          : componentValue.value.encoded

    const currentHex =
      currentValue instanceof Uint8Array
        ? Binary.toHex(currentValue)
        : currentValue
    if (currentHex !== nextValue)
      setComponentValue({ type: CodecComponentType.Initial, value: nextValue })
    // Synchronize browser history navigation into the editor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  useEffect(() => {
    if (componentValue.type !== CodecComponentType.Updated) return
    if (componentValue.value.empty) {
      if (data != null) setData(null)
      return
    }
    if (!codec) return

    try {
      const encoded =
        componentValue.value.encoded ?? codec.enc(componentValue.value.decoded)
      const nextData = Binary.toHex(encoded)
      if (nextData !== data) setData(nextData)
    } catch {
      // Partial structured input has no stable SCALE representation yet.
    }
  }, [codec, componentValue, data, setData])

  return (
    <section className="grid min-w-0 items-start gap-4 @5xl:grid-cols-[minmax(22rem,0.85fr)_minmax(28rem,1.15fr)]">
      <div className="flex min-w-0 flex-col gap-4">
        <section className="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3.5">
            <div className="flex gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-polkadot/10 text-polkadot">
                <Braces className="size-4.5" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-sm font-semibold">Type definition</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Describe the shape of the value, or open the syntax help.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
              <SyntaxHelp />
              <div
                className={
                  error
                    ? "flex items-center gap-1.5 text-xs font-medium text-destructive"
                    : "flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400"
                }
              >
                {error ? (
                  <CircleAlert className="size-3.5" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="size-3.5" aria-hidden="true" />
                )}
                {error ? "Invalid type" : "Valid type"}
              </div>
            </div>
          </div>
          <textarea
            className="min-h-72 w-full resize-y bg-background/60 p-4 font-mono text-[13px] leading-5 font-normal outline-none transition-colors placeholder:text-muted-foreground focus:bg-background @5xl:min-h-96"
            aria-label="Type definition"
            aria-invalid={error ? true : undefined}
            value={definition}
            spellCheck={false}
            onChange={(event) => setDefinition(event.target.value)}
          />
          {error ? (
            <div className="border-t border-destructive/20 bg-destructive/5 px-4 py-3 font-mono text-xs text-destructive">
              {error}
            </div>
          ) : null}
        </section>
      </div>

      <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
        <div className="flex gap-3 border-b border-border px-4 py-3.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-polkadot/10 text-polkadot">
            <BinaryIcon className="size-4.5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Value</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Changes to either representation update the other immediately.
            </p>
          </div>
        </div>
        {lookup && codec ? (
          <div className="flex flex-col gap-2 py-2">
            <BinaryDisplay
              metadata={lookup.metadata}
              codec={codec}
              codecType={0}
              value={componentValue}
              onUpdate={(value) =>
                setComponentValue({
                  type: CodecComponentType.Updated,
                  value,
                })
              }
            />
            <div className="min-w-0 overflow-auto p-2">
              <EditCodec
                metadata={lookup.metadata}
                codecType={0}
                value={componentValue}
                onUpdate={(value) =>
                  setComponentValue({
                    type: CodecComponentType.Updated,
                    value,
                  })
                }
              />
            </div>
          </div>
        ) : (
          <div className="flex min-h-64 flex-col items-center justify-center gap-2 p-8 text-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <CircleAlert className="size-4.5" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium">Waiting for a valid type</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Fix the type definition to enable the encoded and structured value
              editors.
            </p>
          </div>
        )}
      </section>
    </section>
  )
}

const SyntaxHelp = () => (
  <Dialog>
    <DialogTrigger asChild>
      <button
        type="button"
        className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <BookOpenText className="size-3.5" aria-hidden="true" />
        Syntax help
      </button>
    </DialogTrigger>
    <DialogContent className="flex max-h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-2xl flex-col">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <BookOpenText className="size-4" aria-hidden="true" />
          Type syntax reference
        </DialogTitle>
        <p className="text-sm text-muted-foreground">
          Write one root type. Whitespace and line breaks are ignored.
        </p>
      </DialogHeader>
      <DialogBody className="min-h-0 overflow-y-auto">
        <SyntaxReference />
      </DialogBody>
    </DialogContent>
  </Dialog>
)

const SyntaxReference = () => (
  <div className="space-y-5 text-sm text-card-foreground">
    <div>
      <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Building blocks
      </h3>
      <div className="divide-y divide-border rounded-lg border border-border bg-background">
        <SyntaxRow
          code="u8 · i32 · bool · str"
          description="Primitive integers, booleans, characters, and strings"
        />
        <SyntaxRow
          code="compact"
          description="A compact-encoded unsigned integer"
        />
        <SyntaxRow
          code="Vec<u8> · Arr<u8, 32>"
          description="Variable and fixed-length collections"
        />
        <SyntaxRow
          code="Option<u32> · Result<u32, str>"
          description="Optional values and success or error results"
        />
        <SyntaxRow
          code="[u32, bool]"
          description="A tuple; use [] for an empty tuple"
        />
        <SyntaxRow
          code="{ account: Arr<u8, 32>, free: u128 }"
          description="A struct with named fields"
        />
        <SyntaxRow
          code="BitSequence<LSB>"
          description="A bit sequence using LSB or MSB ordering"
        />
      </div>
    </div>

    <div>
      <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Enums
      </h3>
      <p className="mb-2 text-xs leading-5 text-muted-foreground">
        Variants are indexed from zero in declaration order. Add an{" "}
        <code className="font-mono text-foreground">@index</code> only when a
        variant uses a different SCALE index.
      </p>
      <CodeExample>{`Enum {
  None: [],
  Some: u32,
  Error@7: { message: str }
}`}</CodeExample>
    </div>

    <div>
      <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Named and recursive types
      </h3>
      <p className="mb-2 text-xs leading-5 text-muted-foreground">
        Declare reusable types with a name beginning in{" "}
        <code className="font-mono text-foreground">$</code>. Declarations are
        hoisted, so they can refer to types declared later. Finish with the root
        type you want to edit.
      </p>
      <CodeExample>{`$Hash = Arr<u8, 32>
$Node = Enum {
  End: [],
  Next: { hash: $Hash, next: $Node }
}
$Node`}</CodeExample>
    </div>
  </div>
)

const SyntaxRow = ({
  code,
  description,
}: {
  code: string
  description: string
}) => (
  <div className="flex flex-col gap-1 px-3 py-2.5">
    <code className="font-mono text-xs text-foreground">{code}</code>
    <span className="text-xs text-muted-foreground">{description}</span>
  </div>
)

const CodeExample = ({ children }: { children: string }) => (
  <pre className="overflow-x-auto rounded-lg border border-border bg-background p-3 font-mono text-xs leading-5 text-foreground">
    {children}
  </pre>
)

const useFragmentParamState = <T extends string | null>(
  key: string,
  fallback: T,
  encode: (value: string) => string = identity,
  decode: (value: string) => string = identity,
) => {
  const location = useLocation()
  const [value, setValue] = useState<T>(() => {
    const initialValue = getHashParams().get(key)
    return (initialValue == null ? fallback : decode(initialValue)) as T
  })

  useEffect(() => {
    const nextValue = getHashParams(location).get(key)
    setValue((nextValue == null ? fallback : decode(nextValue)) as T)
  }, [decode, fallback, key, location])

  const update = useCallback(
    (nextValue: string | null) => {
      setValue((nextValue ?? fallback) as T)
      const params = getHashParams()
      if (nextValue == null) params.delete(key)
      else params.set(key, encode(nextValue))

      const url = new URL(globalThis.location.href)
      url.hash = params.toString()
      globalThis.history.replaceState(globalThis.history.state, "", url)
    },
    [encode, fallback, key],
  )

  return [value, update] as const
}

const identity = (value: string) => value

const codecValueCandidates = (value: unknown) => {
  if (typeof value === "number" && Number.isSafeInteger(value)) {
    return [value, BigInt(value)]
  }
  if (typeof value === "bigint") {
    const asNumber = Number(value)
    if (Number.isSafeInteger(asNumber) && BigInt(asNumber) === value) {
      return [value, asNumber]
    }
  }
  return [value]
}

const codecValuesEqual = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) return true
  if (typeof left === "number" && typeof right === "bigint") {
    return Number.isSafeInteger(left) && BigInt(left) === right
  }
  if (typeof left === "bigint" && typeof right === "number") {
    return Number.isSafeInteger(right) && left === BigInt(right)
  }
  if (left instanceof Uint8Array && right instanceof Uint8Array) {
    return (
      left.length === right.length &&
      left.every((value, i) => value === right[i])
    )
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length &&
      left.every((value, i) => codecValuesEqual(value, right[i]))
    )
  }
  if (left && right && typeof left === "object" && typeof right === "object") {
    const leftEntries = Object.entries(left)
    const rightRecord = right as Record<string, unknown>
    return (
      leftEntries.length === Object.keys(rightRecord).length &&
      leftEntries.every(
        ([key, value]) =>
          Object.hasOwn(rightRecord, key) &&
          codecValuesEqual(value, rightRecord[key]),
      )
    )
  }
  return false
}
