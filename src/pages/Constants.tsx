import { ViewCodec } from "@/codec-components/ViewCodec"
import { ButtonGroup } from "@/components/ButtonGroup"
import { DocsRenderer } from "@/components/DocsRenderer"
import { ExpandBtn } from "@/components/Expand"
import { AddToWorkspace } from "@/components/IconButton"
import { JsonDisplay } from "@/components/JsonDisplay"
import { LoadingMetadata } from "@/components/Loading"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { withSubscribe } from "@/components/withSuspense"
import { pushWorkspaceEntry, setWorkspaceOpen } from "@/components/Workspace"
import { lookup$, runtimeCtx$ } from "@/state/chains/chain.state"
import { getTypeComplexity } from "@/utils/shape"
import { CodecComponentType } from "@polkadot-api/react-builder"
import { state, useStateObservable, withDefault } from "@react-rxjs/core"
import { Dot, SquareEqual } from "lucide-react"
import { HexString } from "polkadot-api"
import { FC, useState } from "react"
import { firstValueFrom, map } from "rxjs"
import { twMerge } from "tailwind-merge"
import { v4 } from "uuid"
import { ValueDisplay } from "./Storage/StorageSubscriptions"

const metadataConstants$ = state(
  lookup$.pipe(
    map((lookup) =>
      lookup.metadata.pallets
        .filter((p) => p.constants.length > 0)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((p) => ({
          name: p.name,
          constants: p.constants.sort((a, b) => a.name.localeCompare(b.name)),
        })),
    ),
  ),
)

export const Constants = withSubscribe(
  () => {
    const entries = useStateObservable(metadataConstants$)

    return (
      <div className="p-4 pb-0 flex flex-col gap-2 items-start leading-relaxed overflow-auto">
        <ul>
          {entries.map(({ name, constants }) => (
            <PalletConstants key={name} pallet={name} entries={constants} />
          ))}
        </ul>
      </div>
    )
  },
  {
    fallback: <LoadingMetadata />,
  },
)

const PalletConstants: FC<{
  pallet: string
  entries: Array<{
    name: string
    type: number
    value: HexString
    docs: string[]
  }>
}> = ({ pallet, entries }) => {
  const [expanded, setExpanded] = useState(false)

  return (
    <li className="group">
      <div
        className="flex items-center gap-2 cursor-pointer"
        onClick={() => setExpanded((e) => !e)}
      >
        <ExpandBtn expanded={expanded} />
        <div>{pallet}</div>
        <AddToWorkspace
          className="h-7 w-7 opacity-0 group-hover:opacity-100"
          onClick={async (evt) => {
            evt.stopPropagation()
            const ctx = await firstValueFrom(runtimeCtx$)

            addPalletConstantsToWorkspace(
              pallet,
              Object.fromEntries(
                entries.map((entry) => [
                  entry.name,
                  ctx.dynamicBuilder
                    .buildConstant(pallet, entry.name)
                    .dec(entry.value),
                ]),
              ),
            )
            setWorkspaceOpen(true)
          }}
        />
      </div>
      {expanded && (
        <ul>
          {entries.map((props) => (
            <ConstantEntry key={props.name} {...props} />
          ))}
        </ul>
      )}
    </li>
  )
}

type ConstantsWorkspaceContext = {
  values: Record<string, unknown>
}

const addPalletConstantsToWorkspace = (
  pallet: string,
  values: Record<string, unknown>,
) => {
  pushWorkspaceEntry({
    id: v4(),
    source: "Constants",
    title: `${pallet}`,
    icon: SquareEqual,
    context: { values },
    content: ConstantsWorkspaceEntry,
  })
}

const ConstantsWorkspaceEntry: FC<{ context: ConstantsWorkspaceContext }> = ({
  context,
}) => {
  return (
    <div className="space-y-3 p-3 text-sm">
      <JsonDisplay collapsed={1} src={context.values} />
    </div>
  )
}

const constantValueProps$ = state(
  runtimeCtx$.pipe(
    map(({ dynamicBuilder, lookup }) => ({
      builder: dynamicBuilder,
      lookup,
    })),
  ),
  null,
)

const ConstantEntry: FC<{
  name: string
  type: number
  value: HexString
  docs: string[]
}> = ({ name, type, value, docs }) => {
  const props = useStateObservable(constantValueProps$)
  const [expanded, setExpanded] = useState(false)

  if (!props) return null

  const isInline = getTypeComplexity(props.lookup(type), true) === "inline"

  const titleElement = (
    <div
      className={twMerge(
        "flex items-center gap-2",
        !isInline && "cursor-pointer",
      )}
      onClick={() => setExpanded((e) => !e)}
    >
      {isInline ? <Dot size={16} /> : <ExpandBtn expanded={expanded} />}
      <Tooltip disableHoverableContent>
        <TooltipTrigger className="cursor-default">
          <div className={isInline ? "text-foreground/60" : ""}>
            {name + (isInline ? ":" : "")}
          </div>
        </TooltipTrigger>
        {docs.length ? (
          <TooltipContent>
            <DocsRenderer docs={docs} className="max-h-none" />
          </TooltipContent>
        ) : null}
      </Tooltip>
      {isInline ? (
        <ViewCodec
          codecType={type}
          value={{
            type: CodecComponentType.Initial,
            value: value,
          }}
          metadata={props.lookup.metadata}
        />
      ) : null}
    </div>
  )

  return (
    <li className="pl-4">
      {titleElement}
      {!isInline && expanded && (
        <ConstantValue
          type={type}
          decoded={props.builder.buildDefinition(type).dec(value)}
        />
      )}
    </li>
  )
}

const defaultedCtx$ = runtimeCtx$.pipeState(withDefault(null))
const ConstantValue: FC<{ type: number; decoded: unknown }> = ({
  type,
  decoded,
}) => {
  const [mode, setMode] = useState<"json" | "decoded">("decoded")
  const ctx = useStateObservable(defaultedCtx$)
  if (!ctx) return null

  return (
    <div className="pl-6 py-2 flex flex-col gap-2 items-start overflow-hidden w-full">
      <ButtonGroup
        value={mode}
        onValueChange={setMode as any}
        items={[
          {
            value: "decoded",
            content: "Decoded",
          },
          {
            value: "json",
            content: "JSON",
          },
        ]}
      />
      <div className="overflow-auto w-full">
        <ValueDisplay
          mode={mode}
          ctx={ctx}
          type={type}
          value={decoded}
          title="Value"
        />
      </div>
    </div>
  )
}
