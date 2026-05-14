import { EnumVar, StructVar, Var } from "@polkadot-api/metadata-builders"
import { NOTIN } from "@polkadot-api/react-builder"
import { Enum } from "polkadot-api"
import { mapObject } from "polkadot-api/utils"

const complexTypes = new Set<Var["type"]>([
  "tuple",
  "array",
  "sequence",
  "struct",
  "enum",
  "result",
  "option",
])
export const isComplex = (type: Var["type"]) => complexTypes.has(type)

export const isEnumComplex = <T extends EnumVar>(
  shape: T,
  type: keyof T["value"],
): boolean => {
  const innerShape = shape.value[type]
  return isComplex(
    innerShape.type === "lookupEntry" ? innerShape.value.type : innerShape.type,
  )
}

export const getEnumInnerVar = <T extends EnumVar>(
  shape: T,
  type: keyof T["value"],
): Var => {
  const innerShape = shape.value[type]
  return innerShape.type === "lookupEntry" ? innerShape.value : innerShape
}
export const getEnumInnerType = <T extends EnumVar>(
  shape: T,
  type: keyof T["value"],
) => getEnumInnerVar(shape, type).type

export const getStructInnerType = <T extends StructVar>(
  shape: T,
  key: keyof T["value"],
) => {
  return shape.value[key].type
}

const MAX_DEPTH = 5
export const getDefaultValue = (innerVar: Var, depth = 0): any => {
  if (depth > MAX_DEPTH) return NOTIN
  const nextDefault = (v: Var) => getDefaultValue(v, depth + 1)

  switch (innerVar.type) {
    case "void":
      return null
    case "option":
      return undefined
    case "sequence":
      return []
    case "struct":
      return mapObject(innerVar.value, (v) => nextDefault(v))
    case "array":
      return new Array(innerVar.len)
        .fill(0)
        .map(() => nextDefault(innerVar.value))
    case "tuple":
      return innerVar.value.map(nextDefault)
    case "enum": {
      const selected = Object.entries(innerVar.value)[0]
      return selected
        ? Enum(
            selected[0],
            nextDefault(
              selected[1].type === "lookupEntry"
                ? selected[1].value
                : selected[1],
            ),
          )
        : NOTIN
    }
  }
  return NOTIN
}

export const getEnumDefaultValue = <T extends EnumVar>(
  shape: T,
  type: keyof T["value"],
) => {
  const innerVar = getEnumInnerVar(shape, type)
  return getDefaultValue(innerVar)
}

export const getFinalType = (shape: any, name: string) => {
  const innerType = shape.value[name]
  switch (innerType.type) {
    case "primitive":
      return innerType.value
    case "compact":
      return innerType.size
    case "AccountId20":
    case "AccountId32":
      return innerType.type
  }
}

type TypeComplexity = "inline" | "multiple" | "tree"
export const getTypeComplexity = (
  lookupType: Var,
  viewMode = false,
): TypeComplexity => {
  switch (lookupType.type) {
    case "array":
    case "sequence":
      if (
        lookupType.value.type === "primitive" &&
        lookupType.value.value === "u8"
      ) {
        return "inline"
      }
      return maxComplexity(
        "multiple",
        getTypeComplexity(lookupType.value, viewMode),
      )
    case "tuple":
      return reduceMaxComplexity(
        "multiple",
        lookupType.value.map((v) => () => getTypeComplexity(v, viewMode)),
      )
    case "enum":
      return reduceMaxComplexity(
        "inline",
        Object.values(lookupType.value).map((v) => () => {
          const inner = getTypeComplexity(
            v.type === "lookupEntry" ? v.value : v,
            viewMode,
          )
          return inner === "inline" ? "inline" : "tree"
        }),
      )
    case "struct":
      return reduceMaxComplexity(
        "multiple",
        Object.values(lookupType.value).map((v) => () => {
          const inner = getTypeComplexity(v, viewMode)
          return inner === "inline" ? "inline" : "tree"
        }),
      )
    case "option":
      return maxComplexity(
        viewMode ? "inline" : "multiple",
        getTypeComplexity(lookupType.value, viewMode),
      )
    case "result":
      return reduceMaxComplexity(viewMode ? "inline" : "multiple", [
        () => getTypeComplexity(lookupType.value.ok, viewMode),
        () => getTypeComplexity(lookupType.value.ko, viewMode),
      ])
    default:
      return "inline"
  }
}
const highCx: Array<TypeComplexity> = ["tree", "multiple"]
const maxComplexity = (a: TypeComplexity, b: TypeComplexity) =>
  highCx.find((c) => a === c || b == c) ?? "inline"
const reduceMaxComplexity = (
  initial: TypeComplexity,
  fns: Array<() => TypeComplexity>,
) =>
  fns.reduce((acc, fn) => {
    if (acc === "tree") return acc
    return maxComplexity(acc, fn())
  }, initial)
