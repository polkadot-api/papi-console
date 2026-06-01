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
import { getTypeComplexity } from "@/utils/shape"
import type { RuntimeContext } from "@polkadot-api/observable-client"
import { CodecComponentType } from "@polkadot-api/react-builder"
import { state, useStateObservable } from "@react-rxjs/core"
import { Dot, SquareEqual } from "lucide-react"
import { HexString } from "polkadot-api"
import { FC, useState } from "react"
import { firstValueFrom, map } from "rxjs"
import { twMerge } from "tailwind-merge"
import { v4 } from "uuid"
import { BlockPicker, selectedBlock$ } from "./Storage/BlockPicker"
import { ValueDisplay } from "./Storage/StorageSubscriptions"

const metadataConstants$ = state(
  selectedBlock$.pipe(
    map(({ ctx }) =>
      [...ctx.lookup.metadata.pallets]
        .filter((p) => p.constants.length > 0)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((p) => ({
          name: p.name,
          constants: [...p.constants].sort((a, b) =>
            a.name.localeCompare(b.name),
          ),
        })),
    ),
  ),
)

export const Constants = withSubscribe(
  () => {
    const entries = useStateObservable(metadataConstants$)

    return (
      <div className="p-4 space-y-2 overflow-auto @container">
        <div className="w-full border-b border-border pb-3">
          <label className="inline-flex flex-col gap-1 text-sm font-medium">
            Block
            <BlockPicker />
          </label>
        </div>
        <ul className="grid w-full grid-cols-[repeat(auto-fill,minmax(min(100%,25rem),1fr))] gap-2">
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
  return (
    <li className="min-w-0 rounded-lg border border-border bg-card text-card-foreground shadow-sm">
      <div className="flex min-h-14 items-center gap-3 border-b border-border px-3">
        <h2 className="truncate flex-1">{pallet}</h2>
        <AddToWorkspace
          onClick={async () => {
            const { ctx } = await firstValueFrom(selectedBlock$)

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
      <ul className="divide-y divide-border">
        {entries.map((props) => (
          <ConstantEntry key={props.name} {...props} />
        ))}
      </ul>
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
  selectedBlock$.pipe(
    map(({ ctx }) => ({
      ctx,
      builder: ctx.dynamicBuilder,
      lookup: ctx.lookup,
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
        "flex min-w-0 items-center gap-2",
        !isInline && "cursor-pointer",
      )}
      onClick={() => setExpanded((e) => !e)}
    >
      <span className="shrink-0">
        {isInline ? <Dot size={16} /> : <ExpandBtn expanded={expanded} />}
      </span>
      <Tooltip disableHoverableContent>
        <TooltipTrigger className="min-w-0 cursor-default shrink-0">
          <div
            className={twMerge(
              "truncate text-left text-sm",
              isInline ? "text-foreground/60" : "font-medium",
            )}
          >
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
        <div className="min-w-0 text-sm">
          <ViewCodec
            codecType={type}
            value={{
              type: CodecComponentType.Initial,
              value: value,
            }}
            metadata={props.lookup.metadata}
          />
        </div>
      ) : null}
    </div>
  )

  return (
    <li className="min-w-0 px-3 py-2">
      {titleElement}
      {!isInline && expanded && (
        <ConstantValue
          ctx={props.ctx}
          type={type}
          decoded={props.builder.buildDefinition(type).dec(value)}
        />
      )}
    </li>
  )
}

const ConstantValue: FC<{
  ctx: Pick<RuntimeContext, "lookup" | "dynamicBuilder">
  type: number
  decoded: unknown
}> = ({ ctx, type, decoded }) => {
  const [mode, setMode] = useState<"json" | "decoded">("decoded")

  return (
    <div className="flex w-full flex-col items-start gap-2 overflow-hidden py-2 pl-6">
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
      <div className="w-full overflow-auto">
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
