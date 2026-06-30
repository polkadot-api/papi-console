import { CopyText } from "@/components/Copy"
import { Chopsticks, Spinner } from "@/components/Icons"
import SliderToggle from "@/components/Toggle"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  AUTO_RPC_ENDPOINT,
  currentWsStatus$,
  LIGHT_CLIENT_ENDPOINT,
  Network,
  networkCategories,
  onChangeChain,
  SelectedChain,
  selectedChain$,
} from "@/state/chains/chain.state"
import { addCustomNetwork, getCustomNetwork } from "@/state/chains/networks"
import { Input } from "@polkahub/ui-components"
import { useStateObservable } from "@react-rxjs/core"
import { Check, ChevronDown } from "lucide-react"
import { StatusChange } from "polkadot-api/ws"
import { FC, useMemo, useState } from "react"
import { twMerge } from "tailwind-merge"

export function NetworkSwitcher({ className }: { className?: string }) {
  const [open, setOpen] = useState(false)
  const selectedChain = useStateObservable(selectedChain$)
  const websocketStatus = useStateObservable(currentWsStatus$)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className={twMerge(
            "min-w-0 gap-2 justify-between text-base px-3 border border-border bg-input",
            className,
          )}
        >
          <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-left flex items-center gap-1">
            {getChainLabel(selectedChain)}
            {selectedChain.withChopsticks ? (
              <Chopsticks className="inline-block align-text-top" />
            ) : null}
            <span className="text-sm text-muted-foreground">
              {getConnectionLabel(selectedChain, websocketStatus)}
            </span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DialogTrigger>
      <NetworkSwitchDialogContent
        key={`${selectedChain.network.id}-${selectedChain.endpoint}`}
        selectedChain={selectedChain}
        onClose={() => setOpen(false)}
      />
    </Dialog>
  )
}

const NetworkSwitchDialogContent: FC<{
  selectedChain: SelectedChain
  onClose: () => void
}> = ({ selectedChain, onClose }) => {
  const [query, setQuery] = useState("")
  const [network, setNetwork] = useState(selectedChain.network)
  const [endpoint, setEndpoint] = useState(selectedChain.endpoint)
  const [withChopsticks, setWithChopsticks] = useState(
    selectedChain.withChopsticks,
  )
  const customUrl = normalizeWsUrl(query)
  const canFork = endpoint !== LIGHT_CLIENT_ENDPOINT
  const forked = canFork && withChopsticks
  const hasChanged =
    network.id !== selectedChain.network.id ||
    endpoint !== selectedChain.endpoint ||
    forked !== selectedChain.withChopsticks

  const selectNetwork = (
    next: Network,
    nextEndpoint = defaultEndpoint(next),
  ) => {
    setNetwork(next)
    setEndpoint(nextEndpoint)
    if (nextEndpoint === LIGHT_CLIENT_ENDPOINT) {
      setWithChopsticks(false)
    }
  }

  const selectCustomUrl = (url: string) => {
    setNetwork(createCustomNetwork(url))
    setEndpoint(url)
  }

  const setConnection = (nextEndpoint: string) => {
    setEndpoint(nextEndpoint)
    if (nextEndpoint === LIGHT_CLIENT_ENDPOINT) {
      setWithChopsticks(false)
    }
  }

  const toggleChopsticks = () => {
    if (endpoint === LIGHT_CLIENT_ENDPOINT) return
    setWithChopsticks(!withChopsticks)
  }

  const confirm = () => {
    if (network.id === "custom") {
      if (
        endpoint.startsWith("ws://localhost") ||
        endpoint.startsWith("ws://127.0.0.1")
      ) {
        const localNetwork = networkCategories.find(
          (cat) => cat.name === "Localhost",
        )?.networks[0]
        if (localNetwork) {
          onChangeChain({
            network: localNetwork,
            endpoint,
            withChopsticks: forked,
          })
          onClose()
          return
        }
      }
      addCustomNetwork(endpoint)
      onChangeChain({
        network: getCustomNetwork(),
        endpoint,
        withChopsticks: forked,
      })
    } else {
      onChangeChain({ network, endpoint, withChopsticks: forked })
    }
    onClose()
  }

  return (
    <DialogContent
      className="flex h-[min(720px,calc(100vh-2rem))] w-[calc(100vw-2rem)] max-w-160 flex-col"
      onEscapeKeyDown={(evt) => {
        if (
          evt.target instanceof HTMLElement &&
          (evt.target.tagName === "INPUT" ||
            evt.target.attributes.getNamedItem("cmdk-list"))
        ) {
          evt.preventDefault()
        }
      }}
    >
      <DialogHeader>
        <DialogTitle>Switch Network</DialogTitle>
      </DialogHeader>
      <DialogBody className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden md:flex-row">
          <NetworkList
            query={query}
            selectedNetwork={network}
            customUrl={customUrl}
            onQueryChange={setQuery}
            onNetworkSelect={selectNetwork}
            onCustomSelect={selectCustomUrl}
          />
          <ConnectionList
            network={network}
            endpoint={endpoint}
            onEndpointChange={setConnection}
          />
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t pt-3">
          {canFork ? (
            <div className="flex items-center gap-2">
              <Chopsticks size={18} />
              <Label htmlFor="use-chopsticks" className="cursor-pointer">
                Fork with Chopsticks
              </Label>
              <SliderToggle
                id="use-chopsticks"
                isToggled={forked}
                toggle={toggleChopsticks}
              />
            </div>
          ) : (
            <div />
          )}
          <Button
            className="min-w-28"
            onClick={confirm}
            disabled={
              !hasChanged ||
              (network.id === "custom" && !normalizeWsUrl(endpoint))
            }
          >
            Confirm
          </Button>
        </div>
      </DialogBody>
    </DialogContent>
  )
}

const NetworkList: FC<{
  query: string
  selectedNetwork: Network
  customUrl: string | null
  onQueryChange: (value: string) => void
  onNetworkSelect: (network: Network) => void
  onCustomSelect: (url: string) => void
}> = ({
  query,
  selectedNetwork,
  customUrl,
  onQueryChange,
  onNetworkSelect,
  onCustomSelect,
}) => {
  const categories = useMemo(
    () => networkCategories.filter((category) => category.name !== "Custom"),
    [],
  )

  return (
    <Command className="flex min-h-0 flex-1 basis-0 flex-col overflow-hidden rounded-md border bg-transparent">
      <CommandInput
        value={query}
        onValueChange={onQueryChange}
        placeholder="Search chains, or enter a WebSocket URL"
        className="border-none focus:ring-0"
        autoFocus
      />
      <CommandList className="max-h-none min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <CommandEmpty>
          <div className="px-3 py-4 text-sm text-muted-foreground">
            No matching chains or endpoints.
          </div>
        </CommandEmpty>
        {customUrl ? (
          <CommandGroup heading="Custom">
            <NetworkItem
              value={`custom websocket rpc url ${customUrl}`}
              selected={selectedNetwork.id === "custom"}
              title={customUrl}
              onSelect={() => onCustomSelect(customUrl)}
            />
          </CommandGroup>
        ) : null}
        {categories.map((category) => (
          <CommandGroup key={category.name} heading={category.name}>
            {category.networks.map((network) => (
              <NetworkItem
                key={network.id}
                value={networkSearchValue(category.name, network)}
                selected={selectedNetwork.id === network.id}
                title={network.display}
                onSelect={() => onNetworkSelect(network)}
              />
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </Command>
  )
}

const NetworkItem: FC<{
  value: string
  selected: boolean
  title: string
  onSelect: () => void
}> = ({ value, selected, title, onSelect }) => (
  <CommandItem value={value} onSelect={onSelect}>
    <Check
      className={twMerge(
        "mr-2 h-4 w-4 shrink-0",
        selected ? "opacity-100" : "opacity-0",
      )}
    />
    <div className="truncate text-sm">{title}</div>
  </CommandItem>
)

const ConnectionList: FC<{
  network: Network
  endpoint: string
  onEndpointChange: (endpoint: string) => void
}> = ({ network, endpoint, onEndpointChange }) => {
  const entries = Object.entries(network.endpoints)

  return (
    <div className="flex min-h-0 flex-1 basis-0 flex-col overflow-hidden rounded-md border">
      <div className="shrink-0 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Connection
      </div>
      <RadioGroup
        className="min-h-0 overflow-y-auto overflow-x-hidden p-3 space-y-1"
        value={endpoint}
        onValueChange={onEndpointChange}
      >
        {network.lightclient ? (
          <ConnectionOption
            value={LIGHT_CLIENT_ENDPOINT}
            selected={endpoint === LIGHT_CLIENT_ENDPOINT}
            title="Smoldot"
            subtitle="Light client"
            badge="Default"
          />
        ) : null}
        {entries.length > 1 &&
        network.id !== "custom" &&
        network.id !== "localhost" ? (
          <ConnectionOption
            value={AUTO_RPC_ENDPOINT}
            selected={endpoint === AUTO_RPC_ENDPOINT}
            title="Any WS RPC"
            subtitle={`One of ${entries.length} endpoints`}
          />
        ) : null}
        {network.id !== "custom"
          ? entries.map(([name, url]) => (
              <ConnectionOption
                key={url}
                value={url}
                selected={endpoint === url}
                title={name}
                subtitle={formatUrl(url)}
                copy={url}
              />
            ))
          : null}
        {network.id === "localhost" ? (
          <CustomPortOption
            endpoint={endpoint}
            knownEndpoints={entries.map(([, url]) => url)}
            onEndpointChange={onEndpointChange}
          />
        ) : null}
        {network.id === "custom" && endpoint ? (
          <ConnectionOption
            value={endpoint}
            selected
            title="WebSocket URL"
            subtitle={formatUrl(endpoint)}
            copy={endpoint}
          />
        ) : null}
      </RadioGroup>
    </div>
  )
}

const CustomPortOption: FC<{
  endpoint: string
  knownEndpoints: string[]
  onEndpointChange: (endpoint: string) => void
}> = ({ endpoint, knownEndpoints, onEndpointChange }) => {
  const isKnownEndpoint = (port: string) =>
    knownEndpoints.some(
      (knownEndpoint) => getLocalhostPort(knownEndpoint) === port,
    )
  const [port, setPort] = useState(() => {
    const initialPort = getLocalhostPort(endpoint)
    return !initialPort || isKnownEndpoint(initialPort) ? "" : initialPort
  })
  const endpointValue = port ? `ws://127.0.0.1:${port}` : ""
  const value =
    port && !isKnownEndpoint(port)
      ? port === getLocalhostPort(endpoint)
        ? endpoint
        : endpointValue
      : `custom-localhost-port-${port || "empty"}`
  const selected =
    !!port && getLocalhostPort(endpoint) === port && !isKnownEndpoint(port)

  return (
    <div
      className={twMerge(
        "rounded-md border border-transparent px-3 py-2",
        selected && !isKnownEndpoint(port) && "border-polkadot bg-polkadot/5",
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <RadioGroupItem
          value={value}
          id="connection-localhost-custom-port"
          disabled={!port || isKnownEndpoint(port)}
        />
        <Label
          htmlFor="connection-localhost-custom-port"
          className="min-w-0 flex-1 cursor-pointer"
        >
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-medium">Other ports</span>
            <Badge variant="outline" className="shrink-0 text-xs">
              RPC
            </Badge>
          </div>
          <div className="truncate text-xs text-muted-foreground">
            Local RPC node
          </div>
        </Label>
      </div>
      <Input
        type="number"
        placeholder="Port"
        value={port}
        className="mt-2"
        onChange={(evt) => {
          const nextPort = evt.target.value
          setPort(nextPort)
          if (nextPort) onEndpointChange(`ws://127.0.0.1:${nextPort}`)
        }}
      />
    </div>
  )
}

const ConnectionOption: FC<{
  value: string
  selected: boolean
  title: string
  subtitle: string
  badge?: string
  copy?: string
}> = ({ value, selected, title, subtitle, badge, copy }) => (
  <div
    className={twMerge(
      "flex min-w-0 items-center gap-3 rounded-md border border-transparent px-3 py-2",
      selected && "border-polkadot bg-polkadot/5",
    )}
  >
    <RadioGroupItem value={value} id={`connection-${value}`} />
    <Label
      htmlFor={`connection-${value}`}
      className="min-w-0 flex-1 cursor-pointer"
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate text-sm font-medium">{title}</span>
        {badge ? (
          <Badge variant="outline" className="shrink-0 text-xs">
            {badge}
          </Badge>
        ) : null}
      </div>
      <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
    </Label>
    {copy ? <CopyText text={copy} /> : null}
  </div>
)

const defaultEndpoint = (network: Network) => {
  if (network.lightclient) return LIGHT_CLIENT_ENDPOINT
  const endpoints = Object.values(network.endpoints)
  return network.id === "localhost" || endpoints.length === 1
    ? endpoints[0]
    : AUTO_RPC_ENDPOINT
}

const createCustomNetwork = (url: string): Network => ({
  id: "custom",
  display: url,
  lightclient: false,
  endpoints: { "WebSocket URL": url },
})

const normalizeWsUrl = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return null
  const candidate =
    trimmed.startsWith("localhost:") || trimmed.startsWith("127.0.0.1:")
      ? `ws://${trimmed}`
      : trimmed

  try {
    const url = new URL(candidate)
    return url.protocol === "ws:" || url.protocol === "wss:"
      ? url.toString()
      : null
  } catch {
    return null
  }
}

const getLocalhostPort = (value: string) => {
  try {
    const url = new URL(value)
    return isLocalUrl(url) ? url.port : null
  } catch {
    return null
  }
}

const networkSearchValue = (category: string, network: Network) =>
  [category, network.display, network.id].join(" ")

const getChainLabel = ({ network, endpoint }: SelectedChain) => {
  if (network.id !== "custom") return network.display
  try {
    const url = new URL(endpoint)
    return isLocalUrl(url) ? "Localhost" : url.hostname
  } catch {
    return endpoint
  }
}

const getConnectionLabel = (
  selectedChain: SelectedChain,
  websocketStatus: StatusChange | null,
) => {
  const { network, endpoint } = selectedChain
  if (endpoint === LIGHT_CLIENT_ENDPOINT) return "Smoldot"
  if (endpoint === AUTO_RPC_ENDPOINT) {
    if (!websocketStatus) return <Spinner className="inline-block" />

    const isReady = "uri" in websocketStatus
    const activeEndpoint = isReady
      ? findEndpointName(network, websocketStatus.uri)
      : null
    return (
      activeEndpoint ??
      (isReady ? (
        formatUrl(websocketStatus.uri)
      ) : (
        <Spinner className="inline-block" />
      ))
    )
  }
  return findEndpointName(network, endpoint) ?? formatUrl(endpoint)
}

const findEndpointName = (network: Network, endpoint: string) =>
  Object.entries(network.endpoints).find(([, url]) => endpoint === url)?.[0]

const formatUrl = (value: string) => {
  try {
    const url = new URL(value)
    if (isLocalUrl(url))
      return url.port ? `${url.hostname}:${url.port}` : url.hostname
    return url.hostname
  } catch {
    return value
  }
}

const isLocalUrl = (url: URL) =>
  url.hostname === "localhost" || url.hostname === "127.0.0.1"
