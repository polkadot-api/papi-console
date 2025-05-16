import { CommandPopover } from "@/components/CommandPopover"
import { CopyText } from "@/components/Copy"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import {
  isValidUri,
  Network,
  networkCategories,
  onChangeChain,
  SelectedChain,
  selectedChain$,
} from "@/state/chains/chain.state"
import { addCustomNetwork, getCustomNetwork } from "@/state/chains/networks"
import { useStateObservable } from "@react-rxjs/core"
import { Check, ChevronDown, Server } from "lucide-react"
import { FC, useState } from "react"

export function NetworkSwitcher() {
  const [open, setOpen] = useState(false)
  const selectedChain = useStateObservable(selectedChain$)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="w-[200px] flex gap-0 justify-between text-base px-3 border border-border bg-input"
        >
          <span className="overflow-hidden text-ellipsis">
            {selectedChain.network.display}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DialogTrigger>
      <NetworkSwitchDialogContent
        key={selectedChain.endpoint}
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
  const [selectedNetwork, setSelectedNetwork] = useState<Network>(
    selectedChain.network,
  )
  const currentRpc = selectedChain.endpoint ?? "light-client"
  const [selectedRpc, setSelectedRpc] = useState<string>(currentRpc)
  const [enteredText, setEnteredText] = useState<string>("")

  const hasChanged =
    selectedNetwork.id !== selectedChain.network.id ||
    selectedRpc !== currentRpc

  const handleNetworkSelect = (network: Network) => {
    if (network === selectedNetwork) return

    setSelectedNetwork(network)
    setSelectedRpc(
      network.lightclient
        ? "light-client"
        : Object.values(network.endpoints)[0],
    )
  }

  const handleConfirm = () => {
    if (selectedNetwork.id === "custom-network") {
      addCustomNetwork(selectedRpc)
      onChangeChain({ network: getCustomNetwork(), endpoint: selectedRpc })
      setEnteredText("")
    } else {
      onChangeChain({
        network: selectedNetwork,
        endpoint: selectedRpc,
      })
    }
    onClose()
  }

  return (
    <DialogContent
      className="sm:max-w-[425px] min-h-[450px] max-h-full flex flex-col"
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
      <div className="h-full grow flex flex-col">
        <CommandPopover
          placeholder="Search or enter a custom URI"
          value={enteredText}
          onValueChange={setEnteredText}
          selectedValue={selectedNetwork.id}
        >
          <CommandList>
            <CommandEmpty>
              <div className="text-foreground/50">No networks found.</div>
            </CommandEmpty>
            <ScrollArea className="h-[260px]">
              {networkCategories.map((category) => (
                <CommandGroup key={category.name} heading={category.name}>
                  {category.networks.map((network) => (
                    <CommandItem
                      key={network.id}
                      onSelect={() => handleNetworkSelect(network)}
                      value={
                        network.display.includes(category.name)
                          ? network.display
                          : `${category.name} ${network.display}`
                      }
                    >
                      <Check
                        className={`mr-2 h-4 w-4 ${
                          selectedNetwork.id === network.id
                            ? "opacity-100"
                            : "opacity-0"
                        }`}
                      />
                      {network.display}
                    </CommandItem>
                  ))}
                  {category.name === "Custom" && isValidUri(enteredText) ? (
                    <CommandItem
                      value={enteredText}
                      onSelect={() => {
                        handleNetworkSelect({
                          id: "custom-network",
                          lightclient: false,
                          endpoints: { custom: enteredText },
                          display: enteredText,
                        })
                      }}
                    >
                      <Check
                        className={`mr-2 h-4 w-4 ${
                          selectedNetwork.id === "custom-network"
                            ? "opacity-100"
                            : "opacity-0"
                        }`}
                      />
                      {enteredText}
                    </CommandItem>
                  ) : null}
                </CommandGroup>
              ))}
            </ScrollArea>
          </CommandList>
        </CommandPopover>
        <div className="h-[50vh] flex flex-col gap-2">
          {selectedNetwork ? (
            <div className="grow-1 overflow-hidden flex flex-col">
              <p className="py-2">Network: {selectedNetwork.display}</p>
              <div className="overflow-auto">
                <RadioGroup value={selectedRpc} onValueChange={setSelectedRpc}>
                  {selectedNetwork.lightclient ? (
                    <ConnectionOption
                      value="light-client"
                      isSelected={selectedRpc === "light-client"}
                      name="Light Client (smoldot)"
                      type="light"
                    />
                  ) : null}
                  {Object.entries(selectedNetwork.endpoints).map(
                    ([rpcName, url]) => (
                      <ConnectionOption
                        value={url}
                        isSelected={selectedRpc === url}
                        name={rpcName}
                        type="rpc"
                        url={url}
                      />
                    ),
                  )}
                </RadioGroup>
              </div>
            </div>
          ) : null}
          {selectedRpc && selectedRpc !== "light-client" && (
            <div className="mt-4 p-3 border rounded-md bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Server className="h-4 w-4 text-muted-foreground" />
                  <Label
                    htmlFor="use-chopsticks"
                    className="font-medium cursor-pointer"
                  >
                    Fork with Chopsticks
                  </Label>
                </div>
                <Switch id="use-chopsticks" />
              </div>
              <p className="text-xs text-muted-foreground mt-1 ml-6">
                Create a local development fork of this chain
              </p>
            </div>
          )}
        </div>
      </div>
      <Button
        onClick={handleConfirm}
        disabled={
          !selectedNetwork ||
          !hasChanged ||
          (selectedNetwork.id === "custom-network" && !selectedRpc)
        }
      >
        Confirm Selection
      </Button>
    </DialogContent>
  )
}

const ConnectionOption: FC<{
  isSelected: boolean
  value: string
  name: string
  type: "light" | "rpc"
  url?: string
}> = ({ isSelected, value, name, type, url }) => (
  <div
    className={`overflow-hidden p-3 border rounded-md ${isSelected ? "border-primary bg-primary/5" : "border-border"}`}
  >
    <div className="flex items-start space-x-2">
      <RadioGroupItem value={value} id={`chain-${value}`} className="mt-1" />
      <div className="grid gap-0.5 flex-grow">
        <Label htmlFor={`chain-${value}`} className="font-medium">
          {name}
          {type === "light" ? (
            <Badge variant="outline" className="ml-2 text-xs">
              Light Client
            </Badge>
          ) : (
            <Badge variant="outline" className="ml-2 text-xs">
              RPC
            </Badge>
          )}
          <p className="text-xs text-muted-foreground">
            {type === "light"
              ? "Browser light client"
              : url?.includes("127.0.0.1")
                ? "Local RPC node"
                : "Remote RPC node"}
          </p>
        </Label>
      </div>
    </div>

    {/* Show URL for RPC endpoints */}
    {url ? (
      <div className="mt-2 pt-2 border-t">
        <div className="flex items-center justify-between gap-1">
          <div className="flex-1 overflow-hidden">
            <code className="text-xs bg-muted p-1 rounded block overflow-hidden text-ellipsis whitespace-nowrap">
              {url}
            </code>
          </div>
          <CopyText text={url} />
        </div>
      </div>
    ) : null}
  </div>
)
