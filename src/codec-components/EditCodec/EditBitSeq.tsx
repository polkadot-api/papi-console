import { type EditBitSeq, NOTIN } from "@polkadot-api/react-builder"
import { TextInputField } from "./codec-components"
import { useGenericSynchronizeInput } from "@/components/useSynchroniseInput"

const getValidation = (value: string) =>
  !!value.match(/^[01]+$/) ? null : `Only "0" and "1" allowed`

export const CBitSeq: EditBitSeq = ({ value, onValueChanged }) => {
  const [inputValue, setInputValue] = useGenericSynchronizeInput<
    Array<0 | 1>,
    string
  >(
    value,
    onValueChanged,
    (v) =>
      getValidation(v) ? NOTIN : (v.split("").map(Number) as Array<0 | 1>),
    "",
    (v) => v.join(""),
    () => true,
  )

  return (
    <TextInputField
      value={inputValue}
      onChange={setInputValue}
      placeholder="0101"
      warn={getValidation(inputValue) !== null}
      error={getValidation(inputValue)}
    />
  )
}
