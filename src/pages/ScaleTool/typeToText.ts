import { V14Lookup } from "@polkadot-api/substrate-bindings"

const indent = (value: string) =>
  value
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n")

export const lookupTypeToText = (lookup: V14Lookup, typeId: number) => {
  const visiting = new Set<number>()

  const print = (id: number): string => {
    const entry = lookup[id]
    if (!entry) throw new Error(`Lookup type ${id} does not exist`)
    if (visiting.has(id))
      throw new Error(
        "Recursive runtime types are not supported by the type editor yet",
      )

    visiting.add(id)
    try {
      switch (entry.def.tag) {
        case "primitive":
          return entry.def.value.tag
        case "compact":
          return `compact`
        case "sequence":
          return `Vec<${print(entry.def.value)}>`
        case "array":
          return `Arr<${print(entry.def.value.type)}, ${entry.def.value.len}>`
        case "tuple":
          return `[${entry.def.value.map(print).join(", ")}]`
        case "composite": {
          const fields = entry.def.value
          if (fields.every((field) => field.name == null))
            return `[${fields.map((field) => print(field.type)).join(", ")}]`

          const body = fields
            .map(
              (field, index) =>
                `${field.name ?? `item_${index}`}: ${print(field.type)}`,
            )
            .join(",\n")
          return `{\n${indent(body)}\n}`
        }
        case "variant": {
          const body = entry.def.value
            .sort((a, b) => a.index - b.index)
            .map((variant, idx) => {
              const fields = variant.fields
              const value =
                fields.length === 0
                  ? "[]"
                  : fields.every((field) => field.name != null)
                    ? `{\n${indent(
                        fields
                          .map((field) => `${field.name}: ${print(field.type)}`)
                          .join(",\n"),
                      )}\n}`
                    : fields.length === 1
                      ? print(fields[0].type)
                      : `[${fields.map((field) => print(field.type)).join(", ")}]`
              const label =
                variant.index === idx
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
    } finally {
      visiting.delete(id)
    }
  }

  return print(typeId)
}
