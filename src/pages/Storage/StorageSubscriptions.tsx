import { PathsRoot } from "@/codec-components/common/paths.state"
import { ViewCodec } from "@/codec-components/ViewCodec"
import { CopyBinary } from "@/codec-components/ViewCodec/CopyBinary"
import { ButtonGroup } from "@/components/ButtonGroup"
import { JsonDisplay } from "@/components/JsonDisplay"
import { workspaceEntryCtxOrAdd$ } from "@/components/Workspace"
import { Link } from "@/hashParams"
import { cn } from "@/lib/utils"
import { BlockState } from "@/state/block.state"
import { shortStr } from "@/utils"
import { ViewValue } from "@/ViewValue"
import { RuntimeContext } from "@polkadot-api/observable-client"
import { CodecComponentType, NOTIN } from "@polkadot-api/react-builder"
import { Button } from "@polkahub/ui-components"
import { state, useStateObservable } from "@react-rxjs/core"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Enum } from "polkadot-api"
import { fromHex } from "polkadot-api/utils"
import { FC, MouseEvent, ReactNode, useEffect, useMemo, useState } from "react"
import { useParams } from "react-router-dom"
import { Virtuoso } from "react-virtuoso"
import { filter, switchMap } from "rxjs"
import { BlockStatusIcon } from "../Explorer/Detail/BlockState"
import { setBlockHashValue } from "./BlockPicker"
import { setMode } from "./Storage"
import {
  idToStorageSubscription,
  KeyCodec,
  selectEntry,
  storageSubscriptionToWorkspaceEntry,
  StorageSubscriptionValue,
  stringifyArg,
} from "./storage.state"
import { setValue } from "./StorageDecode"
import { setKeysEnabled, setKeyValue } from "./StorageQuery"

export const StorageSubscriptions: FC = () => {
  const params = useParams()

  if (!params.subId) return null

  return (
    <div className="p-2 w-full border-t border-border">
      <h2 className="text-lg text-foreground mb-2">Result</h2>
      <ul className="flex flex-col gap-2">
        <StorageSubscriptionBox id={params.subId} />
      </ul>
    </div>
  )
}

const storageSubscriptionCtx$ = state(
  (id: string) =>
    workspaceEntryCtxOrAdd$(id, async () => {
      const sub = await idToStorageSubscription(id)
      return storageSubscriptionToWorkspaceEntry(sub)
    }),
  null,
)
const storageSubscriptionStatus$ = state(
  (id: string) =>
    storageSubscriptionCtx$(id).pipe(
      filter((v) => v != null),
      switchMap((v) => v.status$),
    ),
  Enum("loading"),
)

const StorageSubscriptionBox: FC<{ id: string }> = ({ id }) => {
  const status = useStateObservable(storageSubscriptionStatus$(id))
  useSynchronizeInputs(id)

  switch (status.type) {
    case "loading":
      return (
        <SubscriptionBox subscription={id}>
          {() => <div>Loading…</div>}
        </SubscriptionBox>
      )
    case "value":
      return <ValueSubscriptionBox subscription={id} />
    case "values":
      return <ValuesSubscriptionBox subscription={id} />
  }
}

const ValueSubscriptionBox: FC<{ subscription: string }> = ({
  subscription,
}) => {
  const status = useStateObservable(storageSubscriptionStatus$(subscription))
  const subCtx = useStateObservable(storageSubscriptionCtx$(subscription))
  if (status.type !== "value" || !subCtx) return null
  const { ctx, payload, type, blockHash } = status.value

  return (
    <SubscriptionBox
      subscription={subscription}
      actions={
        blockHash ? (
          <div className="text-center">
            <p className="text-sm">Block Hash</p>
            <Link to={`/explorer/${blockHash}`} className="underline">
              <p className="font-mono text-xs">{shortStr(blockHash, 6)}</p>
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
          single={!subCtx.isEntries}
          mode={mode}
        />
      )}
    </SubscriptionBox>
  )
}

const onHold = (cb: () => void) => (evt: MouseEvent) => {
  const target = evt.target
  if (!target) return

  let paused = false
  let repeatingToken: any = null
  const startToken = setTimeout(() => {
    repeatingToken = setInterval(() => {
      if (paused) return
      cb()
    }, 80)
  }, 300)

  const stop = () => {
    target.removeEventListener("mouseout", pause)
    target.removeEventListener("mouseenter", resume)
    clearTimeout(startToken)
    clearTimeout(repeatingToken)
  }
  const pause = () => {
    paused = true
  }
  const resume = () => {
    paused = false
  }

  window.addEventListener("mouseup", stop, {
    once: true,
  })
  target.addEventListener("mouseout", pause)
  target.addEventListener("mouseenter", resume)
}

const ValuesSubscriptionBox: FC<{ subscription: string }> = ({
  subscription,
}) => {
  const ctx = useStateObservable(storageSubscriptionCtx$(subscription))
  const status = useStateObservable(storageSubscriptionStatus$(subscription))
  const [target, setTarget] = useState<number | "best">("best")

  if (status.type !== "values" || !ctx) return null

  const targetValueIdx =
    target === "best"
      ? status.value.length - 1
      : status.value.findIndex((v) => v.height > target) - 1
  const targetValue = status.value[targetValueIdx] as
    | StorageSubscriptionValue
    | undefined
  const hasNext = targetValueIdx < status.value.length - 1
  const hasPrev = targetValueIdx > 0

  const incrementTarget = (v: number) => {
    setTarget((target) => {
      const targetValueIdx =
        target === "best"
          ? status.value.length - 1
          : status.value.findIndex((v) => v.height > target) - 1

      const nextIdx = targetValueIdx + v
      return nextIdx === status.value.length - 1
        ? "best"
        : status.value[nextIdx].height
    })
  }

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
              onClick={() => incrementTarget(-1)}
              onMouseDown={onHold(() => incrementTarget(-1))}
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
              onClick={() => incrementTarget(1)}
              onMouseDown={onHold(() => incrementTarget(1))}
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
            single={!ctx.isEntries}
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

  const ctx = useStateObservable(storageSubscriptionCtx$(subscription))
  const status = useStateObservable(storageSubscriptionStatus$(subscription))
  if (!status || !ctx) return null

  const argString = ctx.args
    ? `(${[...ctx.args.map(stringifyArg), ...(ctx.isEntries ? ["…"] : [])]})`
    : "(…)"

  return (
    <li className="border rounded bg-card text-card-foreground p-2">
      <div className="flex justify-between items-center pb-1 overflow-hidden">
        <h3 className="overflow-hidden text-ellipsis whitespace-nowrap">
          {ctx.name}
          {argString}
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

  if (!encodedValue || value === undefined) {
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
      return keyCodec ? fromHex(keyCodec.enc(...value)) : null
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

const useSynchronizeInputs = (id: string) => {
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const params = await idToStorageSubscription(id)
      if (cancelled) return
      setBlockHashValue(params.blockHash ?? "Latest")
      selectEntry({
        pallet: params.pallet,
        entry: params.item,
      })
      setMode(params.value.type)
      // Let entry settle
      await Promise.resolve()
      if (params.value.type === "query") {
        if (cancelled) return
        setKeysEnabled(params.value.value.length)
        params.value.value.forEach((value, idx) => setKeyValue({ idx, value }))
      } else {
        setValue(params.value.value)
      }
    }
    run()

    return () => {
      cancelled = true
    }
  }, [id])
}
