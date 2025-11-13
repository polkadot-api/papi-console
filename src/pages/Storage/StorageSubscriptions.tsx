import { PathsRoot } from "@/codec-components/common/paths.state"
import { ViewCodec } from "@/codec-components/ViewCodec"
import { CopyBinary } from "@/codec-components/ViewCodec/CopyBinary"
import { ButtonGroup } from "@/components/ButtonGroup"
import { JsonDisplay } from "@/components/JsonDisplay"
import { cn } from "@/lib/utils"
import { dynamicBuilder$, metadata$ } from "@/state/chains/chain.state"
import { ViewValue } from "@/ViewValue"
import { CodecComponentType, NOTIN } from "@polkadot-api/react-builder"
import { state, useStateObservable } from "@react-rxjs/core"
import { PauseCircle, PlayCircle, Trash2 } from "lucide-react"
import { Binary } from "polkadot-api"
import { FC, useMemo, useState } from "react"
import { Virtuoso } from "react-virtuoso"
import {
  KeyCodec,
  removeStorageSubscription,
  StorageSubscription,
  storageSubscription$,
  storageSubscriptionKeys$,
  toggleSubscriptionPause,
} from "./storage.state"

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
          {storageSubscription.completed ? null : (
            <button onClick={() => toggleSubscriptionPause(subscription)}>
              {storageSubscription.paused ? (
                <PlayCircle {...iconButtonProps} />
              ) : (
                <PauseCircle {...iconButtonProps} />
              )}
            </button>
          )}
          <button onClick={() => removeStorageSubscription(subscription)}>
            <Trash2 {...iconButtonProps} />
          </button>
        </div>
      </div>
      {mode === "decoded" ? (
        <DecodedResultDisplay
          storageSubscription={storageSubscription}
          subscriptionKey={subscription}
        />
      ) : (
        <JsonResultDisplay storageSubscription={storageSubscription} />
      )}
    </li>
  )
}

const DecodedResultDisplay: FC<{
  storageSubscription: StorageSubscription
  subscriptionKey: string
}> = ({ storageSubscription, subscriptionKey }) => {
  if (storageSubscription.status.type === "loading") {
    return <div className="text-sm text-foreground/50">Loading…</div>
  }
  if (storageSubscription.status.type === "value") {
    return (
      <div className="max-h-[60svh] overflow-auto">
        <PathsRoot.Provider value={subscriptionKey}>
          <ValueDisplay
            mode="decoded"
            type={storageSubscription.type}
            value={storageSubscription.status.value}
            title={"Result"}
          />
        </PathsRoot.Provider>
      </div>
    )
  }

  const lastValue =
    storageSubscription.status.value[
      storageSubscription.status.value.length - 1
    ]
  if (!lastValue) {
    throw new Error("nonsense")
  }
  if (lastValue.result.type === "error") {
    return (
      <div className="text-sm text-foreground/50">{lastValue.result.value}</div>
    )
  }

  if (storageSubscription.single) {
    return (
      <div className="max-h-[60svh] overflow-auto">
        <PathsRoot.Provider value={subscriptionKey}>
          <ValueDisplay
            mode="decoded"
            type={storageSubscription.type}
            value={lastValue.result.value.value}
            title={"Result"}
          />
        </PathsRoot.Provider>
      </div>
    )
  }

  const values = lastValue.result.value.value as Array<{
    keyArgs: unknown[]
    value: unknown
  }>

  const renderItem = (keyArgs: unknown[], value: unknown, idx: number) => (
    <div key={idx} className={itemClasses}>
      <PathsRoot.Provider value={`${subscriptionKey}-${idx}`}>
        <KeyDisplay value={keyArgs} keyCodec={lastValue.keyCodec} />
        <ValueDisplay
          mode="decoded"
          title="Value"
          value={value}
          type={storageSubscription.type}
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
  storageSubscription: StorageSubscription
}> = ({ storageSubscription }) => {
  if (storageSubscription.status.type === "loading") {
    return <div className="text-sm text-foreground/50">Loading…</div>
  }

  if (storageSubscription.status.type === "value") {
    return (
      <div className="max-h-[60svh] overflow-auto">
        <JsonDisplay src={storageSubscription.status.value} />
      </div>
    )
  }

  const lastValue =
    storageSubscription.status.value[
      storageSubscription.status.value.length - 1
    ]

  return (
    <div className="max-h-[60svh] overflow-auto">
      <JsonDisplay src={lastValue.result.value} />
    </div>
  )
}

const itemClasses = "py-2 border-b first:pt-0 last:pb-0 last:border-b-0"
const VirtuosoItem: FC = (props) => <div {...props} className={itemClasses} />

const metadataState$ = state(metadata$, null)
const dynamicBuilderState$ = state(dynamicBuilder$, null)
export const ValueDisplay: FC<{
  type: number
  title: string
  value: unknown | NOTIN
  mode: "decoded" | "json"
}> = ({ type, title, value, mode }) => {
  const metadata = useStateObservable(metadataState$)
  const builder = useStateObservable(dynamicBuilderState$)

  const [codec, encodedValue] = useMemo(() => {
    if (!builder) return [null!, null!]
    const codec = builder.buildDefinition(type)
    const encodedValue = (() => {
      try {
        return codec.enc(value)
      } catch (_) {
        return null
      }
    })()
    return [codec, encodedValue] as const
  }, [builder, value, type])

  if (!metadata || !builder) return null
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
            metadata={metadata}
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
