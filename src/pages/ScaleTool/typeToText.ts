import { V14Lookup } from "@polkadot-api/substrate-bindings"

const INLINE_TYPE_LIMIT = 10

const indent = (value: string) =>
  value
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n")

const referencesOf = (entry: V14Lookup[number]): number[] => {
  switch (entry.def.tag) {
    case "sequence":
      return [entry.def.value]
    case "array":
      return [entry.def.value.type]
    case "tuple":
      return entry.def.value
    case "composite":
      return entry.def.value.map((field) => field.type)
    case "variant":
      return entry.def.value.flatMap((variant) =>
        variant.fields.map((field) => field.type),
      )
    case "primitive":
    case "compact":
    case "bitSequence":
      return []
  }
}

const getReachableTypes = (lookup: V14Lookup, rootTypeId: number) => {
  const result: number[] = []
  const seen = new Set<number>()
  const pending = [rootTypeId]

  while (pending.length) {
    const id = pending.pop()!
    if (seen.has(id)) continue
    const entry = lookup[id]
    if (!entry) throw new Error(`Lookup type ${id} does not exist`)

    seen.add(id)
    result.push(id)
    pending.push(...referencesOf(entry).toReversed())
  }

  return result
}

const createNameAllocator = (
  lookup: V14Lookup,
  fallbackPrefix: "CircularRef" | "Type",
) => {
  const names = new Map<number, string>()
  const usedNames = new Set<string>()
  let fallbackIndex = 1

  const getName = (id: number) => {
    const existing = names.get(id)
    if (existing) return existing

    const pathName = lookup[id].path.at(-1)
    const candidate = pathName?.replace(/[^a-zA-Z0-9_]/g, "_")
    let name =
      candidate && /^[a-zA-Z_]/.test(candidate) && !usedNames.has(candidate)
        ? candidate
        : null

    if (!name) {
      do name = `${fallbackPrefix}${fallbackIndex++}`
      while (usedNames.has(name))
    }

    usedNames.add(name)
    names.set(id, name)
    return name
  }

  return { getName, hasName: (id: number) => names.has(id) }
}

const getWellKnownVariant = (entry: V14Lookup[number]) => {
  if (entry.def.tag !== "variant" || entry.path.length !== 1) return null
  if (
    entry.path[0] === "Option" &&
    entry.params.length === 1 &&
    entry.params[0].name === "T" &&
    entry.params[0].type != null
  ) {
    return { type: "option" as const, value: entry.params[0].type }
  }
  if (
    entry.path[0] === "Result" &&
    entry.params.length === 2 &&
    entry.params[0].name === "T" &&
    entry.params[0].type != null &&
    entry.params[1].name === "E" &&
    entry.params[1].type != null
  ) {
    return {
      type: "result" as const,
      ok: entry.params[0].type,
      error: entry.params[1].type,
    }
  }
  return null
}

const printDefinition = (
  lookup: V14Lookup,
  id: number,
  printReference: (id: number) => string,
) => {
  const entry = lookup[id]
  if (!entry) throw new Error(`Lookup type ${id} does not exist`)

  switch (entry.def.tag) {
    case "primitive":
      return entry.def.value.tag
    case "compact":
      return "compact"
    case "sequence":
      return `Vec<${printReference(entry.def.value)}>`
    case "array":
      return `Arr<${printReference(entry.def.value.type)}, ${entry.def.value.len}>`
    case "tuple":
      return `[${entry.def.value.map(printReference).join(", ")}]`
    case "composite": {
      const fields = entry.def.value
      if (fields.every((field) => field.name == null))
        return `[${fields.map((field) => printReference(field.type)).join(", ")}]`

      const body = fields
        .map(
          (field, index) =>
            `${field.name ?? `item_${index}`}: ${printReference(field.type)}`,
        )
        .join(",\n")
      return `{\n${indent(body)}\n}`
    }
    case "variant": {
      const wellKnown = getWellKnownVariant(entry)
      if (wellKnown?.type === "option")
        return `Option<${printReference(wellKnown.value)}>`
      if (wellKnown?.type === "result")
        return `Result<${printReference(wellKnown.ok)}, ${printReference(wellKnown.error)}>`

      const body = entry.def.value
        .toSorted((a, b) => a.index - b.index)
        .map((variant, index) => {
          const fields = variant.fields
          const value =
            fields.length === 0
              ? "[]"
              : fields.every((field) => field.name != null)
                ? `{\n${indent(
                    fields
                      .map(
                        (field) =>
                          `${field.name}: ${printReference(field.type)}`,
                      )
                      .join(",\n"),
                  )}\n}`
                : fields.length === 1
                  ? printReference(fields[0].type)
                  : `[${fields.map((field) => printReference(field.type)).join(", ")}]`
          const label =
            variant.index === index
              ? variant.name
              : `${variant.name}@${variant.index}`
          return `${label}: ${value}`
        })
        .join(",\n")
      return `Enum {\n${indent(body)}\n}`
    }
    case "bitSequence": {
      const isLsb = lookup[entry.def.value.bitOrderType]?.path
        .at(-1)
        ?.toUpperCase()
        .startsWith("LSB")
      return `BitSequence<${isLsb ? "LSB" : "MSB"}>`
    }
  }
}

const printInline = (lookup: V14Lookup, typeId: number) => {
  const active = new Set<number>()
  const declarations = new Map<number, string>()
  const { getName, hasName } = createNameAllocator(lookup, "CircularRef")

  const print = (id: number): string => {
    if (active.has(id)) return `$${getName(id)}`
    if (declarations.has(id)) return `$${getName(id)}`

    active.add(id)
    const value = printDefinition(lookup, id, print)
    active.delete(id)

    if (!hasName(id)) return value
    declarations.set(id, value)
    return `$${getName(id)}`
  }

  const root = print(typeId)
  if (!declarations.size) return root

  const declarationText = [...declarations]
    .map(([id, value]) => `$${getName(id)} = ${value}`)
    .join("\n")
  return `${declarationText}\n${root}`
}

const isComplexType = (entry: V14Lookup[number]) => {
  if (getWellKnownVariant(entry)) return false

  switch (entry.def.tag) {
    case "composite":
    case "variant":
      return entry.def.value.length >= 2
    case "tuple":
      return entry.def.value.length >= 2
    case "primitive":
    case "compact":
    case "sequence":
    case "array":
    case "bitSequence":
      return false
  }
}

const printDeclared = (
  lookup: V14Lookup,
  typeIds: number[],
  rootTypeId: number,
) => {
  const declaredTypes = new Set(
    typeIds.filter((id) => isComplexType(lookup[id])),
  )
  const active = new Set<number>()
  const declarations = new Map<number, string>()
  const { getName, hasName } = createNameAllocator(lookup, "Type")
  declaredTypes.forEach(getName)

  const print = (id: number): string => {
    if (declaredTypes.has(id) || declarations.has(id)) return `$${getName(id)}`
    if (active.has(id)) return `$${getName(id)}`

    active.add(id)
    const value = printDefinition(lookup, id, print)
    active.delete(id)

    if (!hasName(id)) return value
    declarations.set(id, value)
    return `$${getName(id)}`
  }

  declaredTypes.forEach((id) => {
    active.add(id)
    const value = printDefinition(lookup, id, print)
    active.delete(id)
    declarations.set(id, value)
  })

  const root = print(rootTypeId)
  if (!declarations.size) return root

  const declarationText = [...declarations]
    .map(([id, value]) => `$${getName(id)} = ${value}`)
    .join("\n")
  return `${declarationText}\n${root}`
}

export const lookupTypeToText = (lookup: V14Lookup, typeId: number) => {
  const reachableTypes = getReachableTypes(lookup, typeId)
  return reachableTypes.length < INLINE_TYPE_LIMIT
    ? printInline(lookup, typeId)
    : printDeclared(lookup, reachableTypes, typeId)
}
