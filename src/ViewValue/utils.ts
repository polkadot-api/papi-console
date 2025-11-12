import { getEnumInnerVar, isComplex } from "@/utils/shape"
import { Var } from "@polkadot-api/metadata-builders"

export const isComplexNested = (field: Var, value: any): boolean => {
  if (!isComplex(field.type)) return false

  if (field.type === "enum")
    return isComplexNested(getEnumInnerVar(field, value.type), value.value)

  if (field.type === "option")
    return value == null ? false : isComplexNested(field.value, value)

  if (field.type === "sequence" && value.length === 0) {
    return false
  }

  return true
}
