import { withDefault } from "@/utils/default"
import { EditStr } from "@codec-components"

// TODO
export const CStr: EditStr = ({ value, onValueChanged }) => {
  return (
    <div>
      <input
        className="bg-gray-700 border-none hover:border-none outline-none text-right min-w-96"
        value={withDefault(value, "")}
        onChange={(evt) => {
          onValueChanged(evt.target.value)
        }}
      />
    </div>
  )
}