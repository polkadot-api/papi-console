import { EditCodec } from "@/codec-components/EditCodec"
import { BinaryDisplay } from "@/codec-components/LookupTypeEdit/BinaryDisplay"
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
import { useCallback, useEffect, useMemo, useState } from "react"
import { useLocation } from "react-router-dom"
import { CenteredScrollContainer } from "../AppShell"
import { textToMetadata } from "./textToMetadata"

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
  <CenteredScrollContainer className="p-4 flex flex-col gap-4 overflow-auto">
    <header>
      <h1 className="text-2xl font-bold">SCALE tool</h1>
      <p className="text-sm text-muted-foreground">
        Edit a portable type definition and encode or decode its SCALE value.
        The type and data are stored in the URL fragment for sharing.
      </p>
    </header>
    <TypeTool />
  </CenteredScrollContainer>
)

const TypeTool = () => {
  const [definition, setDefinition] = useFragmentParamState("type", initialType)
  const [data, setData] = useFragmentParamState("data", null)
  const [lookup, setLookup] = useState<MetadataLookup | null>(null)
  const [error, setError] = useState("")
  const [componentValue, setComponentValue] = useState<CodecComponentValue>({
    type: CodecComponentType.Initial,
    value: data ?? "",
  })

  useEffect(() => {
    // Ensure a fresh tool URL is immediately self-contained and shareable.
    setDefinition(definition)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    try {
      const nextLookup = getLookupFn(unifyMetadata(textToMetadata(definition)))
      getDynamicBuilder(nextLookup).buildDefinition(0)
      setLookup(() => nextLookup)
      setError("")
    } catch (error) {
      setLookup(null)
      setError(error instanceof Error ? error.message : String(error))
    }
  }, [definition])

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
    <section className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Type definition
        <textarea
          className="h-40 w-full rounded border border-border bg-background p-3 font-mono text-sm font-normal"
          value={definition}
          spellCheck={false}
          onChange={(event) => setDefinition(event.target.value)}
        />
      </label>
      {error ? <div className="text-sm text-destructive">{error}</div> : null}
      {lookup && codec ? (
        <div className="flex flex-col gap-2">
          <BinaryDisplay
            metadata={lookup.metadata}
            codec={codec}
            codecType={0}
            value={componentValue}
            onUpdate={(value) =>
              setComponentValue({ type: CodecComponentType.Updated, value })
            }
          />
          <div className="p-2">
            <EditCodec
              metadata={lookup.metadata}
              codecType={0}
              value={componentValue}
              onUpdate={(value) =>
                setComponentValue({ type: CodecComponentType.Updated, value })
              }
            />
          </div>
        </div>
      ) : null}
      <div className="border-t pt-3 text-sm text-muted-foreground">
        <h2 className="font-semibold text-foreground">
          Type definition syntax
        </h2>
        <p>
          Primitives, <code>compact</code>, <code>Compact&lt;type&gt;</code>,
          structs, <code>Vec&lt;type&gt;</code>,{" "}
          <code>Arr&lt;type, length&gt;</code>, tuples, indexed enums, and bit
          sequences are supported.
        </p>
        <p>
          Declare reusable or recursive types with <code>$Name = type</code>.
          Declarations are hoisted and may reference types declared later.
        </p>
      </div>
    </section>
  )
}

const useFragmentParamState = <T extends string | null>(
  key: string,
  fallback: T,
) => {
  const location = useLocation()
  const [value, setValue] = useState<T>(
    () => (getHashParams().get(key) as T | null) ?? fallback,
  )

  useEffect(() => {
    setValue((getHashParams(location).get(key) as T | null) ?? fallback)
  }, [fallback, key, location])

  const update = useCallback(
    (nextValue: string | null) => {
      setValue((nextValue ?? fallback) as T)
      const params = getHashParams()
      if (nextValue == null) params.delete(key)
      else params.set(key, nextValue)

      const url = new URL(globalThis.location.href)
      url.hash = params.toString()
      globalThis.history.replaceState(globalThis.history.state, "", url)
    },
    [fallback, key],
  )

  return [value, update] as const
}
