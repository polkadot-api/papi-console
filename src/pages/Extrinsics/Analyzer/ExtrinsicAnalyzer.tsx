import { TextInputField } from "@/components/TextInputField"
import { useHashParamState } from "@/hashParams"
import { Subscribe } from "@react-rxjs/core"
import { FC } from "react"
import { BlockPicker } from "../../Storage/BlockPicker"
import { ExtrinsicDecoder, extrinsicDecoder$ } from "./ExtrinsicDecoder"

export const ExtrinsicAnalyzer: FC = () => {
  const [extrinsicHex, setExtrinsicHex] = useHashParamState(
    "extrinsic",
    () => "",
  )

  return (
    <div className="p-2 space-y-2">
      <h2 className="text-lg font-bold">Analyze Extrinsic</h2>
      <div className="flex items-center gap-1 flex-wrap">
        <div>
          <label>
            Block
            <BlockPicker />
          </label>
        </div>
        <div className="grow">
          <label>
            Extrinsic
            <TextInputField
              className="w-full"
              value={extrinsicHex}
              onChange={setExtrinsicHex}
              placeholder="Extrinsic Hex"
            />
          </label>
        </div>
      </div>
      <Subscribe source$={extrinsicDecoder$} fallback={null}>
        {extrinsicHex ? <ExtrinsicDecoder extrinsic={extrinsicHex} /> : null}
      </Subscribe>
    </div>
  )
}
