import { withDefault } from "@/utils/default"
import { EditStr } from "@polkadot-api/react-builder"

export const CStr: EditStr = ({ value, onValueChanged }) => (
  <input
    type="text"
    className="w-full min-w-0 rounded border border-border bg-input px-4 py-2 leading-tight text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
    value={withDefault(value, "")}
    placeholder="Enter text"
    onChange={(event) => onValueChanged(event.target.value)}
  />
)
