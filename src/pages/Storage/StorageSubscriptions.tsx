import { dynamicBuilder$, metadata$ } from "@/state/chains/chain.state"
import { ViewCodec } from "@/codec-components/ViewCodec"
import { CopyBinary } from "@/codec-components/ViewCodec/CopyBinary"
import { ButtonGroup } from "@/components/ButtonGroup"
import { JsonDisplay } from "@/components/JsonDisplay"
import { CodecComponentType, NOTIN } from "@polkadot-api/react-builder"
import { state, useStateObservable } from "@react-rxjs/core"
import { PauseCircle, PlayCircle, Trash2 } from "lucide-react"
import { FC, useMemo, useState } from "react"
import { Virtuoso } from "react-virtuoso"
import {
  removeStorageSubscription,
  StorageSubscription,
  storageSubscription$,
  storageSubscriptionKeys$,
  stringifyArg,
  toggleSubscriptionPause,
} from "./storage.state"
import { PathsRoot } from "@/codec-components/common/paths.state"

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
        <div className="flex items-center flex-shrink-0 gap-2">
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
  if (!("result" in storageSubscription)) {
    return <div className="text-sm text-foreground/50">Loading…</div>
  }

  if (storageSubscription.single) {
    return (
      <div className="max-h-[60svh] overflow-auto">
        <PathsRoot.Provider value={subscriptionKey}>
          <ValueDisplay
            mode="decoded"
            type={storageSubscription.type}
            value={storageSubscription.result}
            title={"Result"}
          />
        </PathsRoot.Provider>
      </div>
    )
  }

  const values = storageSubscription.result as Array<{
    keyArgs: unknown[]
    value: unknown
  }>

  const renderItem = (keyArgs: unknown[], value: unknown, idx: number) => {
    const title = keyArgs
      .slice(storageSubscription.args?.length ?? 0)
      .map(stringifyArg)
      .join(", ")
    return (
      <div key={idx} className={itemClasses}>
        <PathsRoot.Provider value={`${subscriptionKey}-${idx}`}>
          <ValueDisplay
            mode="decoded"
            title={title}
            value={value}
            type={storageSubscription.type}
          />
        </PathsRoot.Provider>
      </div>
    )
  }

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
      {values.map(({ keyArgs, value }, i) => renderItem(keyArgs, value, i))}
    </div>
  )
}

const JsonResultDisplay: FC<{
  storageSubscription: StorageSubscription
}> = ({ storageSubscription }) => {
  if (!("result" in storageSubscription)) {
    return <div className="text-sm text-foreground/50">Loading…</div>
  }

  return (
    <div className="max-h-[60svh] overflow-auto">
      <JsonDisplay src={storageSubscription.result} />
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
