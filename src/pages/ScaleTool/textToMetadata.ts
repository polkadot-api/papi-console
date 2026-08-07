import { V14Lookup, V15 } from "@polkadot-api/substrate-bindings"

type LookupDef = V14Lookup[number]["def"]
type Primitive = Extract<LookupDef, { tag: "primitive" }>["value"]["tag"]

type TypeNode =
  | { type: "primitive"; value: Primitive }
  | { type: "compact"; value: TypeNode }
  | { type: "struct"; fields: Array<{ name: string; value: TypeNode }> }
  | { type: "sequence"; value: TypeNode }
  | { type: "array"; value: TypeNode; length: number }
  | { type: "tuple"; values: TypeNode[] }
  | {
      type: "enum"
      variants: Array<{ name: string; index: number; value: TypeNode }>
    }
  | { type: "bitSequence"; order: "LSB" | "MSB" }
  | { type: "reference"; name: string }

const wordRegex = /^[a-zA-Z_][a-zA-Z0-9_]*/
const numberRegex = /^\d+/
const referenceRegex = /^\$([a-zA-Z_][a-zA-Z0-9_]*)/

const primitiveTypes = new Set<Primitive>([
  "u8",
  "u16",
  "u32",
  "u64",
  "u128",
  "u256",
  "i8",
  "i16",
  "i32",
  "i64",
  "i128",
  "i256",
  "bool",
  "char",
  "str",
])

const readWord = (text: string, expected: string) => {
  const match = wordRegex.exec(text)
  if (!match) throw new Error(`Expected ${expected}`)
  return [match[0], text.slice(match[0].length)] as const
}

const readReference = (text: string) => {
  const match = referenceRegex.exec(text)
  if (!match) throw new Error("Type names must begin with `$`")
  return [match[1], text.slice(match[0].length)] as const
}

const parseStruct = (text: string): [TypeNode, string] => {
  const fields: Extract<TypeNode, { type: "struct" }>["fields"] = []

  while (!text.startsWith("}")) {
    if (!text) throw new Error("Expected struct to end with `}`")
    const [name, afterName] = readWord(text, "a struct field name")
    if (!afterName.startsWith(":"))
      throw new Error("Expected struct field to have `:`")

    const [value, rest] = parseType(afterName.slice(1))
    fields.push({ name, value })
    text = rest.startsWith(",") ? rest.slice(1) : rest
  }

  return [{ type: "struct", fields }, text.slice(1)]
}

const parseTuple = (text: string): [TypeNode, string] => {
  const values: TypeNode[] = []

  while (!text.startsWith("]")) {
    if (!text) throw new Error("Expected tuple to end with `]`")
    const [value, rest] = parseType(text)
    values.push(value)
    text = rest.startsWith(",") ? rest.slice(1) : rest
  }

  return [{ type: "tuple", values }, text.slice(1)]
}

const parseEnum = (text: string): [TypeNode, string] => {
  const variants: Extract<TypeNode, { type: "enum" }>["variants"] = []

  while (!text.startsWith("}")) {
    if (!text) throw new Error("Expected enum to end with `}`")
    const [name, afterName] = readWord(text, "an enum variant name")
    let rest = afterName
    let index = variants.length

    if (rest.startsWith("@")) {
      const match = numberRegex.exec(rest.slice(1))
      if (!match) throw new Error("Expected an enum variant index after `@`")
      index = Number(match[0])
      if (index > 255)
        throw new Error("Enum variant index must be between 0 and 255")
      rest = rest.slice(match[0].length + 1)
    }
    if (!rest.startsWith(":"))
      throw new Error("Expected enum variant to have `:`")

    const [value, afterValue] = parseType(rest.slice(1))
    variants.push({ name, index, value })
    text = afterValue.startsWith(",") ? afterValue.slice(1) : afterValue
  }

  return [{ type: "enum", variants }, text.slice(1)]
}

const parseType = (text: string): [TypeNode, string] => {
  if (text.startsWith("$")) {
    const [name, rest] = readReference(text)
    return [{ type: "reference", name }, rest]
  }
  if (text.startsWith("{")) return parseStruct(text.slice(1))
  if (text.startsWith("[")) return parseTuple(text.slice(1))

  const [token, rest] = readWord(text, "a type")
  if (primitiveTypes.has(token as Primitive))
    return [{ type: "primitive", value: token as Primitive }, rest]

  switch (token) {
    case "compact":
      return [
        { type: "compact", value: { type: "primitive", value: "u256" } },
        rest,
      ]
    case "Compact": {
      if (!rest.startsWith("<")) throw new Error("Compact expects `<type>`")
      const [value, innerRest] = parseType(rest.slice(1))
      if (!innerRest.startsWith(">"))
        throw new Error("Compact expects to end with `>`")
      return [{ type: "compact", value }, innerRest.slice(1)]
    }
    case "Vec": {
      if (!rest.startsWith("<")) throw new Error("Vector expects `<type>`")
      const [value, innerRest] = parseType(rest.slice(1))
      if (!innerRest.startsWith(">"))
        throw new Error("Vector expects to end with `>`")
      return [{ type: "sequence", value }, innerRest.slice(1)]
    }
    case "Arr": {
      if (!rest.startsWith("<"))
        throw new Error("Array expects `<type, length>`")
      const [value, innerRest] = parseType(rest.slice(1))
      if (!innerRest.startsWith(","))
        throw new Error("Array expects a numeric length parameter")
      const match = numberRegex.exec(innerRest.slice(1))
      if (!match || !innerRest.slice(match[0].length + 1).startsWith(">"))
        throw new Error("Array expects a numeric length parameter")
      return [
        { type: "array", value, length: Number(match[0]) },
        innerRest.slice(match[0].length + 2),
      ]
    }
    case "Enum":
      if (!rest.startsWith("{"))
        throw new Error("Expected Enum to begin with `{`")
      return parseEnum(rest.slice(1))
    case "BitSequence": {
      const match = /^<(LSB|MSB)>/.exec(rest)
      if (!match) throw new Error("BitSequence expects `<LSB>` or `<MSB>`")
      return [
        { type: "bitSequence", order: match[1] as "LSB" | "MSB" },
        rest.slice(match[0].length),
      ]
    }
    default:
      throw new Error(`Unexpected token ${token}`)
  }
}

const parseDocument = (text: string) => {
  const declarations = new Map<string, TypeNode>()
  let firstDeclaration: string | null = null

  while (text.startsWith("$")) {
    const [name, afterName] = readReference(text)
    if (!afterName.startsWith("=")) break
    if (declarations.has(name))
      throw new Error(`Type $${name} is declared twice`)

    const [value, rest] = parseType(afterName.slice(1))
    declarations.set(name, value)
    firstDeclaration ??= name
    text = rest.startsWith(";") ? rest.slice(1) : rest
  }

  if (!text && !firstDeclaration) throw new Error("Expected a type definition")
  const [root, rest] = text
    ? parseType(text)
    : ([{ type: "reference", name: firstDeclaration! }, ""] as const)
  if (rest)
    throw new Error(`Couldn't read all input near: ${rest.slice(0, 20)}`)

  return { declarations, root }
}

const compileDocument = (
  declarations: Map<string, TypeNode>,
  root: TypeNode,
): V14Lookup => {
  const entries: Array<V14Lookup[number] | null> = [null]
  const declarationIds = new Map<string, number>()

  declarations.forEach((_, name) => {
    declarationIds.set(name, entries.length)
    entries.push(null)
  })

  const entry = (id: number, def: LookupDef, path: string[] = []) => {
    entries[id] = { id, def, path, params: [], docs: [] }
  }
  const allocate = () => {
    const id = entries.length
    entries.push(null)
    return id
  }
  const typeId = (node: TypeNode) => {
    if (node.type === "reference") {
      const id = declarationIds.get(node.name)
      if (id == null) throw new Error(`Type $${node.name} is not declared`)
      return id
    }
    const id = allocate()
    compile(id, node)
    return id
  }
  const compile = (id: number, node: TypeNode) => {
    switch (node.type) {
      case "reference": {
        const target = declarationIds.get(node.name)
        if (target == null)
          throw new Error(`Type $${node.name} is not declared`)
        entry(id, {
          tag: "composite",
          value: [
            { name: undefined, type: target, typeName: undefined, docs: [] },
          ],
        })
        return
      }
      case "primitive":
        entry(id, {
          tag: "primitive",
          value: { tag: node.value, value: undefined },
        })
        return
      case "compact":
        entry(id, { tag: "compact", value: typeId(node.value) })
        return
      case "struct":
        entry(id, {
          tag: "composite",
          value: node.fields.map(({ name, value }) => ({
            name,
            type: typeId(value),
            typeName: undefined,
            docs: [],
          })),
        })
        return
      case "sequence":
        entry(id, { tag: "sequence", value: typeId(node.value) })
        return
      case "array":
        entry(id, {
          tag: "array",
          value: { type: typeId(node.value), len: node.length },
        })
        return
      case "tuple":
        entry(id, { tag: "tuple", value: node.values.map(typeId) })
        return
      case "enum":
        entry(id, {
          tag: "variant",
          value: node.variants.map(({ name, index, value }) => ({
            name,
            index,
            docs: [],
            fields:
              value.type === "tuple" && value.values.length === 0
                ? []
                : value.type === "struct"
                  ? value.fields.map((field) => ({
                      name: field.name,
                      type: typeId(field.value),
                      typeName: undefined,
                      docs: [],
                    }))
                  : [
                      {
                        name: undefined,
                        type: typeId(value),
                        typeName: undefined,
                        docs: [],
                      },
                    ],
          })),
        })
        return
      case "bitSequence": {
        const store = allocate()
        entry(store, {
          tag: "primitive",
          value: { tag: "u8", value: undefined },
        })
        const order = allocate()
        entry(order, { tag: "tuple", value: [] }, [
          node.order === "LSB" ? "Lsb0" : "Msb0",
        ])
        entry(id, {
          tag: "bitSequence",
          value: { bitStoreType: store, bitOrderType: order },
        })
      }
    }
  }

  compile(0, root)
  declarations.forEach((node, name) => compile(declarationIds.get(name)!, node))
  return entries as V14Lookup
}

export const textToMetadata = (text: string): V15 => {
  const { declarations, root } = parseDocument(text.replace(/\s+/g, ""))
  const lookup = compileDocument(declarations, root)

  return {
    lookup,
    apis: [],
    custom: [],
    extrinsic: {
      address: 0,
      call: 0,
      extra: 0,
      signature: 0,
      signedExtensions: [],
      version: 0,
    },
    outerEnums: { call: 0, error: 0, event: 0 },
    pallets: [],
    type: 0,
  }
}
