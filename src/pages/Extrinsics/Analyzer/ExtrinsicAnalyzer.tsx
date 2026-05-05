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
    <div className="space-y-4 p-3 md:p-4">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">
          Analyze Extrinsic
        </h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Decode a SCALE-encoded extrinsic against the selected block metadata,
          inspect its signer and extensions, and review the exact call payload
          and fee priority data.
        </p>
      </header>

      <section className="rounded-xl border border-foreground/10 bg-card p-4 shadow-sm">
        <div className="flex gap-4 flex-col lg:flex-row">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground/60">
              Reference Block
            </div>
            <BlockPicker />
          </div>

          <div className="space-y-2 w-full">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground/60">
              Extrinsic Bytes (hex)
            </div>
            <TextInputField
              className="w-full rounded-md bg-input"
              value={extrinsicHex}
              onChange={setExtrinsicHex}
              placeholder="0x..."
            />
          </div>
        </div>
      </section>

      <Subscribe source$={extrinsicDecoder$} fallback={null}>
        {extrinsicHex ? <ExtrinsicDecoder extrinsic={extrinsicHex} /> : null}
      </Subscribe>
    </div>
  )
}
