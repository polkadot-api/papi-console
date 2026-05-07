import { ExpandBtn } from "@/components/Expand"
import { JsonDisplay } from "@/components/JsonDisplay"
import { Dot } from "lucide-react"
import { jsonSerialize } from "polkadot-api/utils"
import {
  ComponentType,
  FC,
  PropsWithChildren,
  ReactNode,
  useState,
} from "react"
import { InlineMortality, MortalityAnalyzer } from "./MortalityAnalyzer"

export const SignedExtensions: FC<{
  extra: Record<string, unknown>
  title?: boolean
}> = ({ extra, title = true }) => (
  <div className="space-y-2">
    {title ? (
      <h3 className="text-sm font-semibold">Signed extensions</h3>
    ) : null}
    <ul className="space-y-3">
      {Object.entries(extra).map(([key, value]) => (
        <SignedExtension key={key} id={key} value={value} />
      ))}
    </ul>
  </div>
)

const SignedExtension: FC<{ id: string; value: unknown }> = ({ id, value }) => {
  const knownExtension = knownSignedExtensions[id]
  if (knownExtension) {
    const { expanded: ExpandedView, inline: InlineView } = knownExtension
    return ExpandedView ? (
      <ExpandableLine
        id={id}
        inlineContent={InlineView ? <InlineView id={id} value={value} /> : null}
      >
        <ExpandedView id={id} value={value} />
      </ExpandableLine>
    ) : InlineView ? (
      <InlineLine
        id={id}
        inlineContent={InlineView ? <InlineView id={id} value={value} /> : null}
      />
    ) : null
  }

  const inlineJson = JSON.stringify(value, jsonSerialize)
  return !inlineJson || inlineJson.length < 30 ? (
    <InlineLine id={id} inlineContent={inlineJson} />
  ) : (
    <ExpandableLine id={id} inlineContent={null}>
      <JsonDisplay src={value} />
    </ExpandableLine>
  )
}

export const knownSignedExtensions: Record<
  string,
  {
    inline?: ComponentType<{ id: string; value: unknown }>
    expanded?: ComponentType<{ id: string; value: unknown }>
  }
> = {
  CheckMortality: {
    expanded: ({ value }) => <MortalityAnalyzer mortality={value as any} />,
    inline: ({ value }) => <InlineMortality mortality={value as any} />,
  },
}

const ExpandableLine: FC<
  PropsWithChildren<{ id: string; inlineContent?: ReactNode }>
> = ({ id, inlineContent, children }) => {
  const [expanded, setExpanded] = useState(false)

  return (
    <li className="space-y-2 rounded-lg border border-foreground/10 bg-foreground/5 px-3 py-2">
      <div className="flex items-center gap-2">
        <ExpandBtn
          className="shrink-0"
          expanded={expanded}
          onClick={() => setExpanded((e) => !e)}
        />
        {id}
        {inlineContent ? (
          <div className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap font-mono text-sm">
            - {inlineContent}
          </div>
        ) : null}
      </div>
      {expanded && children}
    </li>
  )
}

const InlineLine: FC<{ id: string; inlineContent?: ReactNode }> = ({
  id,
  inlineContent,
}) => (
  <li className="flex items-center gap-2 rounded-lg border border-foreground/10 bg-foreground/5 px-3 py-2">
    <div className="flex items-center gap-2">
      <Dot size={16} />
      {id}
    </div>
    {inlineContent ? (
      <div className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap font-mono text-sm">
        - {inlineContent}
      </div>
    ) : null}
  </li>
)
