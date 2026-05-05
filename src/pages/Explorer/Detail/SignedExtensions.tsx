import { ExpandBtn } from "@/components/Expand"
import { JsonDisplay } from "@/components/JsonDisplay"
import { Dot } from "lucide-react"
import { toHex } from "polkadot-api/utils"
import { ComponentType, FC, useState } from "react"
import { MortalityAnalyzer } from "./MortalityAnalyzer"

export const SignedExtensions: FC<{ extra: Record<string, unknown> }> = ({
  extra,
}) => (
  <div className="space-y-2">
    <h3>Signed extensions</h3>
    <ul className="space-y-2">
      {Object.entries(extra).map(([key, value]) => {
        const KnownExtension = knownSignedExtensions[key]
        return KnownExtension ? (
          <KnownExtension key={key} id={key} value={value} />
        ) : (
          <SignedExtension key={key} id={key} value={value} />
        )
      })}
    </ul>
  </div>
)

const SignedExtension: FC<{ id: string; value: unknown }> = ({ id, value }) => {
  const [expanded, setExpanded] = useState(false)
  const inlineJson = JSON.stringify(value, (_, v) =>
    typeof v === "bigint" ? String(v) : v instanceof Uint8Array ? toHex(v) : v,
  )

  if (!inlineJson || inlineJson.length < 40) {
    return (
      <li className="flex items-center flex-wrap gap-1">
        <div className="flex gap-2 items-center">
          <Dot size={16} />
          {id}
        </div>
        {inlineJson ? (
          <div className="whitespace-nowrap">
            - <span className="font-mono text-sm">{inlineJson}</span>
          </div>
        ) : null}
      </li>
    )
  }
  return (
    <li className="space-y-2">
      <div className="flex gap-2 items-center">
        <ExpandBtn expanded={expanded} onClick={() => setExpanded((e) => !e)} />
        {id}
      </div>
      {expanded && <JsonDisplay src={value} />}
    </li>
  )
}

export const knownSignedExtensions: Record<
  string,
  ComponentType<{ id: string; value: unknown }>
> = {
  CheckMortality: ({ id, value }) => {
    return (
      <li className="space-y-2">
        <div className="flex gap-2 items-center">
          <Dot size={16} />
          {id}
        </div>
        <MortalityAnalyzer mortality={value as any} />
      </li>
    )
  },
}
