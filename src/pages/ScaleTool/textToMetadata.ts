import { V14Lookup, V15 } from "@polkadot-api/substrate-bindings"

type LookupDef = V14Lookup[number]["def"]

const wordRegex = /^[a-zA-Z0-9_]+/

const nextToken = (text: string): [string, string] => {
  const word = wordRegex.exec(text)
  if (!word) return [text.slice(0, 1), text.slice(1)]
  return [word[0], text.slice(word[0].length)]
}

const primitiveTypes = [
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
]

const readStruct = (text: string, base: number): [LookupDef[], string] => {
  const result: LookupDef[] = []
  const fields: Extract<LookupDef, { tag: "composite" }>["value"] = []
  result.push({ tag: "composite", value: fields })

  let token = nextToken(text)
  while (token[0] !== "}") {
    if (!token[0]) throw new Error("Expected struct to end with `}`")
    const name = token[0]
    if (!token[1].startsWith(":"))
      throw new Error("Expected struct field to have `:`")

    const innerBase = base + result.length
    const [inner, rest] = textToLookup(token[1].slice(1), innerBase)
    result.push(...inner)
    fields.push({ docs: [], name, type: innerBase, typeName: undefined })
    token = nextToken(rest)
    if (token[0] === ",") token = nextToken(token[1])
  }

  return [result, token[1]]
}

const readTuple = (text: string, base: number): [LookupDef[], string] => {
  const result: LookupDef[] = []
  const fields: number[] = []
  result.push({ tag: "tuple", value: fields })

  while (!text.startsWith("]")) {
    if (!text) throw new Error("Expected tuple to end with `]`")
    const innerBase = base + result.length
    const [inner, rest] = textToLookup(text, innerBase)
    result.push(...inner)
    fields.push(innerBase)
    text = rest.startsWith(",") ? rest.slice(1) : rest
  }

  return [result, text.slice(1)]
}

const readEnum = (text: string, base: number): [LookupDef[], string] => {
  const result: LookupDef[] = []
  const variants: Extract<LookupDef, { tag: "variant" }>["value"] = []
  result.push({ tag: "variant", value: variants })

  let token = nextToken(text)
  while (token[0] !== "}") {
    if (!token[0]) throw new Error("Expected enum to end with `}`")
    const name = token[0]
    let restAfterName = token[1]
    let index = variants.length
    if (restAfterName.startsWith("@")) {
      const indexToken = nextToken(restAfterName.slice(1))
      index = Number(indexToken[0])
      if (!Number.isInteger(index) || index < 0 || index > 255)
        throw new Error("Enum variant index must be between 0 and 255")
      restAfterName = indexToken[1]
    }
    if (!restAfterName.startsWith(":"))
      throw new Error("Expected enum variant to have `:`")

    const innerBase = base + result.length
    const [inner, rest] = textToLookup(restAfterName.slice(1), innerBase)
    result.push(...inner)
    variants.push({
      docs: [],
      name,
      fields: [
        { docs: [], name: undefined, type: innerBase, typeName: undefined },
      ],
      index,
    })
    token = nextToken(rest)
    if (token[0] === ",") token = nextToken(token[1])
  }

  return [result, token[1]]
}

const textToLookup = (text: string, base: number): [LookupDef[], string] => {
  const [token, rest] = nextToken(text)

  if (primitiveTypes.includes(token)) {
    return [
      [
        {
          tag: "primitive",
          value: { tag: token as "u8", value: undefined },
        },
      ],
      rest,
    ]
  }

  switch (token) {
    case "compact":
      return [
        [
          { tag: "compact", value: base + 1 },
          {
            tag: "primitive",
            value: { tag: "u256", value: undefined },
          },
        ],
        rest,
      ]
    case "{":
      return readStruct(rest, base)
    case "Vec": {
      if (!rest.startsWith("<")) throw new Error("Vector expects `<type>`")
      const [inner, innerRest] = textToLookup(rest.slice(1), base + 1)
      if (!innerRest.startsWith(">"))
        throw new Error("Vector expects to end with `>`")
      return [
        [{ tag: "sequence", value: base + 1 }, ...inner],
        innerRest.slice(1),
      ]
    }
    case "Arr": {
      if (!rest.startsWith("<"))
        throw new Error("Array expects `<type, length>`")
      const [inner, innerRest] = textToLookup(rest.slice(1), base + 1)
      const match = /^,(\d+)>/.exec(innerRest)
      if (!match) throw new Error("Array expects a numeric length parameter")
      return [
        [
          { tag: "array", value: { len: Number(match[1]), type: base + 1 } },
          ...inner,
        ],
        innerRest.slice(match[0].length),
      ]
    }
    case "[":
      return readTuple(rest, base)
    case "Enum":
      if (!rest.startsWith("{"))
        throw new Error("Expected Enum to begin with `{`")
      return readEnum(rest.slice(1), base)
    case "BitSequence": {
      const match = /^<(LSB|MSB)>/.exec(rest)
      if (!match) throw new Error("BitSequence expects `<LSB>` or `<MSB>`")
      return [
        [
          {
            tag: "bitSequence",
            value: { bitStoreType: base + 1, bitOrderType: base + 2 },
          },
          { tag: "primitive", value: { tag: "u8", value: undefined } },
          {
            tag: "primitive",
            value: {
              tag: match[1] === "LSB" ? "bool" : "u8",
              value: undefined,
            },
          },
        ],
        rest.slice(match[0].length),
      ]
    }
    default:
      throw new Error(`Unexpected token ${token || "(end of input)"}`)
  }
}

export const textToMetadata = (text: string): V15 => {
  const [definitions, rest] = textToLookup(text.replace(/\s+/g, ""), 0)
  if (rest.length)
    throw new Error(`Couldn't read all input near: ${rest.slice(0, 20)}`)

  const lookup: V14Lookup = definitions.map((def, id) => ({
    def,
    docs: [],
    id,
    params: [],
    path: [],
  }))
  lookup.forEach((entry) => {
    if (entry.def.tag !== "bitSequence") return
    const order = lookup[entry.def.value.bitOrderType]
    order.path = [
      order.def.tag === "primitive" && order.def.value.tag === "bool"
        ? "Lsb0"
        : "Msb0",
    ]
  })

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
