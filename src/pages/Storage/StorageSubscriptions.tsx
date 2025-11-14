import { PathsRoot } from "@/codec-components/common/paths.state"
import { ViewCodec } from "@/codec-components/ViewCodec"
import { CopyBinary } from "@/codec-components/ViewCodec/CopyBinary"
import { ButtonGroup } from "@/components/ButtonGroup"
import { JsonDisplay } from "@/components/JsonDisplay"
import { cn } from "@/lib/utils"
import { shortStr } from "@/utils"
import { ViewValue } from "@/ViewValue"
import { RuntimeContext } from "@polkadot-api/observable-client"
import { CodecComponentType, NOTIN } from "@polkadot-api/react-builder"
import { Button } from "@polkahub/ui-components"
import { useStateObservable } from "@react-rxjs/core"
import { ChevronLeft, ChevronRight, StopCircle, Trash2 } from "lucide-react"
import { Binary, Enum } from "polkadot-api"
import { FC, ReactNode, useMemo, useState } from "react"
import { Virtuoso } from "react-virtuoso"
import { BlockState } from "../Explorer/block.state"
import { BlockStatusIcon } from "../Explorer/Detail/BlockState"
import {
  KeyCodec,
  removeStorageSubscription,
  stopStorageSubscription,
  storageSubscription$,
  storageSubscriptionKeys$,
  StorageSubscriptionValue,
} from "./storage.state"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Link } from "@/hashParams"

export const StorageSubscriptions: FC = () => {
  const keys = useStateObservable(storageSubscriptionKeys$)

  if (!keys.length) return null

  return (
    <div className="p-2 w-full border-t border-border">
      <h2 className="text-lg text-foreground mb-2">Results</h2>
      <ul className="flex flex-col gap-2">
        {keys.map((key) => (
          <StorageSubscriptionBox key={key} subscription={key} />
        ))}
      </ul>
    </div>
  )
}

const StorageSubscriptionBox: FC<{ subscription: string }> = ({
  subscription,
}) => {
  const storageSubscription = useStateObservable(
    storageSubscription$(subscription),
  )
  if (!storageSubscription) return null

  switch (storageSubscription.status.type) {
    case "loading":
      return (
        <SubscriptionBox subscription={subscription}>
          {() => <div>Loading…</div>}
        </SubscriptionBox>
      )
    case "value":
      return <ValueSubscriptionBox subscription={subscription} />
    case "values":
      return <ValuesSubscriptionBox subscription={subscription} />
  }
}

const ValueSubscriptionBox: FC<{ subscription: string }> = ({
  subscription,
}) => {
  const storageSubscription = useStateObservable(
    storageSubscription$(subscription),
  )
  if (!storageSubscription) return null
  const status = storageSubscription.status
  if (status.type !== "value") return null
  const { ctx, payload, type, hash } = status.value

  return (
    <SubscriptionBox
      subscription={subscription}
      actions={
        hash ? (
          <div className="text-center">
            <p className="text-sm">Hash</p>
            <Link to={`/explorer/${hash}`} className="underline">
              <p className="font-mono text-xs">{shortStr(hash, 6)}</p>
            </Link>
          </div>
        ) : null
      }
    >
      {(mode) => (
        <ResultDisplay
          id={subscription}
          subValue={{
            result: Enum("success", {
              ctx,
              type,
              payload: payload,
              hash: null,
            }),
          }}
          single
          mode={mode}
        />
      )}
    </SubscriptionBox>
  )
}

const ValuesSubscriptionBox: FC<{ subscription: string }> = ({
  subscription,
}) => {
  const storageSubscription = useStateObservable(
    storageSubscription$(subscription),
  )
  const [target, setTarget] = useState<number | "best">("best")

  if (!storageSubscription) return null
  const status = storageSubscription.status
  if (status.type !== "values") return null

  const targetValueIdx =
    target === "best"
      ? status.value.length - 1
      : status.value.findIndex((v) => v.height > target) - 1
  const targetValue = status.value[targetValueIdx] as
    | StorageSubscriptionValue
    | undefined
  const hasNext = targetValueIdx < status.value.length - 1
  const hasPrev = targetValueIdx > 0

  return (
    <SubscriptionBox
      subscription={subscription}
      actions={
        targetValue ? (
          <div className="flex items-center gap-1">
            <Button
              variant="secondary"
              className="has-[>svg]:px-1"
              disabled={!hasPrev}
              onClick={() => setTarget(status.value[targetValueIdx - 1].height)}
            >
              <ChevronLeft />
            </Button>
            <div className="text-center">
              <div className="text-sm flex items-center gap-1 justify-center">
                <p>{targetValue.height}</p>
                <BlockStatusIcon
                  size={20}
                  state={
                    targetValue.settled ? BlockState.Finalized : BlockState.Best
                  }
                />
              </div>
              <Link
                to={`/explorer/${targetValue.blockHash}`}
                className="underline"
              >
                <p className="font-mono text-xs">
                  {shortStr(targetValue.blockHash, 6)}
                </p>
              </Link>
            </div>
            <Button
              disabled={!hasNext}
              variant="secondary"
              className="has-[>svg]:px-1"
              onClick={() =>
                setTarget(
                  targetValueIdx === status.value.length - 2
                    ? "best"
                    : status.value[targetValueIdx + 1].height,
                )
              }
            >
              <ChevronRight />
            </Button>
          </div>
        ) : null
      }
    >
      {(mode) =>
        targetValue ? (
          <ResultDisplay
            id={subscription}
            subValue={targetValue}
            single
            mode={mode}
          />
        ) : null
      }
    </SubscriptionBox>
  )
}

const SubscriptionBox: FC<{
  subscription: string
  actions?: ReactNode
  children: (mode: "json" | "decoded") => ReactNode
}> = ({ actions, subscription, children }) => {
  const [mode, setMode] = useState<"json" | "decoded">("decoded")

  const storageSubscription = useStateObservable(
    storageSubscription$(subscription),
  )
  if (!storageSubscription) return null

  const iconButtonProps = {
    size: 20,
    className: "text-polkadot-400 cursor-pointer hover:text-polkadot-500",
  }

  return (
    <li className="border rounded bg-card text-card-foreground p-2">
      <div className="flex justify-between items-center pb-1 overflow-hidden">
        <h3 className="overflow-hidden text-ellipsis whitespace-nowrap">
          {storageSubscription.name}
        </h3>
        <div className="flex items-center shrink-0 gap-2">
          {actions}
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
          {storageSubscription.completed ? (
            <button onClick={() => removeStorageSubscription(subscription)}>
              <Trash2 {...iconButtonProps} />
            </button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={() => stopStorageSubscription(subscription)}>
                  <StopCircle {...iconButtonProps} />
                </button>
              </TooltipTrigger>
              <TooltipContent>Stop subscription</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
      {children(mode)}
    </li>
  )
}

const ResultDisplay: FC<{
  id: string
  subValue: Pick<StorageSubscriptionValue, "result" | "keyCodec">
  single: boolean
  mode: "json" | "decoded"
}> = ({ mode, ...props }) =>
  mode === "decoded" ? (
    <DecodedResultDisplay {...props} />
  ) : (
    <JsonResultDisplay {...props} />
  )

const DecodedResultDisplay: FC<{
  id: string
  subValue: Pick<StorageSubscriptionValue, "result" | "keyCodec">
  single: boolean
}> = ({ subValue, single, id }) => {
  if (subValue.result.type === "error") {
    return (
      <div className="text-sm text-foreground/50">{subValue.result.value}</div>
    )
  }

  const { payload: value, ctx, type } = subValue.result.value

  if (single) {
    return (
      <div className="max-h-[60svh] overflow-auto">
        <PathsRoot.Provider value={id}>
          <ValueDisplay
            mode="decoded"
            type={type}
            value={value}
            ctx={ctx}
            title={"Result"}
          />
        </PathsRoot.Provider>
      </div>
    )
  }

  const values = subValue.result.value.payload as Array<{
    keyArgs: unknown[]
    value: unknown
  }>

  const renderItem = (keyArgs: unknown[], value: unknown, idx: number) => (
    <div key={idx} className={itemClasses}>
      <PathsRoot.Provider value={`${id}-${idx}`}>
        <KeyDisplay value={keyArgs} keyCodec={subValue.keyCodec} />
        <ValueDisplay
          mode="decoded"
          title="Value"
          value={value}
          type={type}
          ctx={ctx}
        />
      </PathsRoot.Provider>
    </div>
  )

  if (values.length > 10) {
    return (
      <Virtuoso
        style={{ height: "60svh" }}
        totalCount={values.length}
        itemContent={(i) =>
          values[i] && renderItem(values[i].keyArgs, values[i].value, i)
        }
        components={{ Item: VirtuosoItem }}
      />
    )
  }

  return (
    <div className="max-h-[60svh] overflow-auto">
      {values.length ? (
        values.map(({ keyArgs, value }, i) => renderItem(keyArgs, value, i))
      ) : (
        <span className="text-foreground/60">Empty</span>
      )}
    </div>
  )
}

const JsonResultDisplay: FC<{
  subValue: Pick<StorageSubscriptionValue, "result" | "keyCodec">
}> = ({ subValue }) => {
  if (subValue.result.type === "error") {
    return (
      <div className="text-sm text-foreground/50">{subValue.result.value}</div>
    )
  }
  return (
    <div className="max-h-[60svh] overflow-auto">
      <JsonDisplay src={subValue.result.value.payload} />
    </div>
  )
}

const itemClasses = "py-2 border-b first:pt-0 last:pb-0 last:border-b-0"
const VirtuosoItem: FC = (props) => <div {...props} className={itemClasses} />

export const ValueDisplay: FC<{
  ctx: Pick<RuntimeContext, "lookup" | "dynamicBuilder">
  type: number
  title: string
  value: unknown | NOTIN
  mode: "decoded" | "json"
}> = ({ ctx, type, title, value, mode }) => {
  const [codec, encodedValue] = useMemo(() => {
    const codec = ctx.dynamicBuilder.buildDefinition(type)
    const encodedValue = (() => {
      try {
        return codec.enc(value)
      } catch (_) {
        return null
      }
    })()
    return [codec, encodedValue] as const
  }, [ctx, value, type])

  if (!encodedValue) {
    return <div className="text-foreground/60">Empty</div>
  }

  return (
    <div>
      <div className="flex flex-1 gap-2 overflow-hidden">
        <CopyBinary value={encodedValue} />
        <h3 className="overflow-hidden text-ellipsis">{title}</h3>
      </div>
      {mode === "decoded" ? (
        <div className="leading-tight">
          <ViewCodec
            codecType={type}
            value={{
              type: CodecComponentType.Initial,
              value: codec.enc(value),
            }}
            metadata={ctx.lookup.metadata}
          />
        </div>
      ) : (
        <JsonDisplay src={value} />
      )}
    </div>
  )
}

const KeyDisplay: FC<{
  value: unknown[]
  keyCodec?: KeyCodec
}> = ({ value, keyCodec }) => {
  const binaryValue = (() => {
    try {
      return keyCodec ? Binary.fromHex(keyCodec.enc(...value)).asBytes() : null
    } catch (_) {
      return null
    }
  })()

  return (
    <div>
      <div className="flex flex-1 gap-2 overflow-hidden">
        {binaryValue ? <CopyBinary value={binaryValue} /> : null}
        <h3 className="overflow-hidden text-ellipsis">Key</h3>
      </div>
      <ol className="leading-tight flex gap-1 items-center flex-wrap">
        {value.map((v, i) => (
          <li
            key={i}
            className={cn("px-1 py-0.5", {
              "border rounded": value.length > 1,
            })}
          >
            <ViewValue value={v} />
          </li>
        ))}
      </ol>
    </div>
  )
}
