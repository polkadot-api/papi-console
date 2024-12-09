import SliderToggle from "@/components/Toggle"
import {
  EditArray,
  EditBool,
  EditOption,
  EditResult,
  EditVoid,
  NOTIN,
} from "@polkadot-api/react-builder"
import { FC, ReactNode, useState } from "react"
import { twMerge } from "tailwind-merge"
import { ListItem } from "../common/ListItem"
import { useSubtreeFocus } from "../common/SubtreeFocus"

export const CBool: EditBool = ({ value, onValueChanged, path }) => {
  return (
    <div className="flex gap-4">
      <label>
        <input
          className="mr-1"
          type="radio"
          value="Yes"
          name={path.join(".")}
          checked={value === true}
          onChange={() => onValueChanged(true)}
        />
        Yes
      </label>
      <label>
        <input
          className="mr-1"
          type="radio"
          value="No"
          name={path.join(".")}
          checked={value === false}
          onChange={() => onValueChanged(false)}
        />
        No
      </label>
    </div>
  )
}

export const CVoid: EditVoid = () => null

export const CArray: EditArray = ({ innerComponents, path }) => {
  const focus = useSubtreeFocus()
  const sub = focus.getNextPath(path)
  if (sub) {
    return innerComponents[Number(sub)]
  }

  return (
    <ul>
      {innerComponents.map((jsx, idx) => (
        <ListItem key={idx} idx={idx} path={[...path, String(idx)]}>
          {jsx}
        </ListItem>
      ))}
    </ul>
  )
}

export const COption: EditOption = ({ value, inner, onValueChanged }) => {
  const selected = value !== undefined
  return (
    <div>
      <label className="flex items-center gap-2 py-1 mb-1">
        <SliderToggle
          isToggled={selected}
          toggle={() =>
            !selected ? onValueChanged(NOTIN) : onValueChanged(undefined)
          }
        />
        <span className="text-base">
          {selected ? "selected" : "not selected"}
        </span>
      </label>
      {inner}
    </div>
  )
}

// TODO
export const CResult: EditResult = ({ value, inner, type }) => {
  return type === "blank" ? null : (
    <>
      {value.success ? "ok" : "ko"}-{inner}
    </>
  )
}

export const TextInputField: FC<{
  className?: string
  error?: string | boolean | null
  softError?: string | boolean | null
  warn?: string | boolean | null
  placeholder?: string
  value: string
  onChange: (value: string) => void
  children?: (inputElement: ReactNode) => ReactNode
}> = ({
  className,
  error,
  softError,
  warn,
  value,
  placeholder,
  onChange,
  children = (v) => v,
}) => {
  const [hasBlurred, blur] = useState(false)

  return (
    <div className="flex gap-1 items-center">
      {children(
        <input
          className={twMerge(
            "px-4 py-2 border border-border leading-tight text-foreground rounded bg-input",
            warn ? "border-yellow-400" : null,
            error ? "border-red-500" : null,
            className,
          )}
          value={value}
          placeholder={placeholder}
          onChange={(evt) => onChange(evt.target.value)}
          onFocus={() => blur(false)}
          onBlur={() => blur(true)}
        />,
      )}
      {(hasBlurred || error) &&
        (typeof (error || softError) === "string" ? (
          <span className="text-red-600 text-sm">{error || softError}</span>
        ) : typeof warn === "string" ? (
          <span className="text-orange-400 text-sm">{warn}</span>
        ) : null)}
    </div>
  )
}
