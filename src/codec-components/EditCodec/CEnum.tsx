import { SearchableSelect } from "@/components/Select"
import { getEnumDefaultValue, isEnumComplex } from "@/utils/shape"
import { EditEnum, NOTIN } from "@polkadot-api/react-builder"
import { Marker } from "../common/Markers"
import { useSubtreeFocus } from "../common/SubtreeFocus"

export const CEnum: EditEnum = ({
  type,
  value,
  tags,
  inner,
  shape,
  onValueChanged,
  path,
}) => {
  const focus = useSubtreeFocus()
  const sub = focus.getNextPath(path)
  if (sub) {
    return inner
  }

  const options = tags.map((t) => t.tag).sort()
  const getOptionType = (option: string) => {
    const innerType = shape.value[option]
    if (innerType.type !== "lookupEntry") return ""
    switch (innerType.value.type) {
      case "primitive":
        return ` (${innerType.value.value})`
      case "compact":
        return ` (${innerType.value.size})`
      case "AccountId20":
      case "AccountId32":
        return ` (${innerType.value.type})`
    }
    return ""
  }

  const isComplexShape = type !== "blank" && isEnumComplex(shape, value.type)
  return (
    <div className="flex flex-col">
      {value === NOTIN ? null : <Marker id={[...path, value.type]} />}
      <div className="flex flex-row flex-wrap text-sm items-center gap-2">
        <SearchableSelect
          setValue={(selected: string | null) => {
            if (selected && options.includes(selected)) {
              const value = getEnumDefaultValue(shape, selected)
              onValueChanged({ type: selected, value })
            }
          }}
          value={value === NOTIN ? "" : value.type}
          options={options.map((option) => ({
            text: option + getOptionType(option),
            value: option,
          }))}
        />
        {!isComplexShape && inner}
      </div>
      {isComplexShape && <div className="flex flex-col pt-1 ">{inner}</div>}
    </div>
  )
}
