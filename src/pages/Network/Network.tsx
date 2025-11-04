import { CommandPopover } from "@/components/CommandPopover"
import { CopyText } from "@/components/Copy"
import { Chopsticks } from "@/components/Icons"
import SliderToggle from "@/components/Toggle"
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
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ScrollArea } from "@/components/ui/scroll-area"
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
import { Check, ChevronDown } from "lucide-react"
import { FC, useState } from "react"
import { twMerge } from "tailwind-merge"

export function NetworkSwitcher({
  forSmallScreen,
}: {
  forSmallScreen?: boolean
}) {
  const [open, setOpen] = useState(false)
  const selectedChain = useStateObservable(selectedChain$)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className={twMerge(
            "w-[200px] gap-0 justify-between text-base px-3 border border-border bg-input self-center",
            forSmallScreen ? "flex md:hidden" : "hidden md:flex",
          )}
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
  const [withChopsticks, setWithChopsticks] = useState(
    selectedChain.withChopsticks ?? false,
  )

  const hasChanged =
    selectedNetwork.id !== selectedChain.network.id ||
    selectedRpc !== currentRpc ||
    selectedChain.withChopsticks !== withChopsticks

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
    const chopsticksEnabled = selectedRpc !== "light-client" && withChopsticks
    if (selectedNetwork.id === "custom-network") {
      addCustomNetwork(selectedRpc)
      onChangeChain({
        network: getCustomNetwork(),
        endpoint: selectedRpc,
        withChopsticks: chopsticksEnabled,
      })
      setEnteredText("")
    } else {
      onChangeChain({
        network: selectedNetwork,
        endpoint: selectedRpc,
        withChopsticks: chopsticksEnabled,
      })
    }
    onClose()
  }

  return (
    <DialogContent
      className="sm:max-w-[425px] min-h-[450px] max-h-full flex flex-col w-auto"
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
      <DialogBody className="flex flex-col overflow-hidden gap-2">
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
                  <RadioGroup
                    value={selectedRpc}
                    onValueChange={setSelectedRpc}
                  >
                    {selectedNetwork.lightclient ? (
                      <ConnectionOption
                        value="light-client"
                        isSelected={selectedRpc === "light-client"}
                        name="Smoldot"
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
                    <Chopsticks size={20} />
                    <Label
                      htmlFor="use-chopsticks"
                      className="font-medium cursor-pointer"
                    >
                      Fork with Chopsticks
                    </Label>
                  </div>
                  <SliderToggle
                    id="use-chopsticks"
                    isToggled={withChopsticks}
                    toggle={() => setWithChopsticks(!withChopsticks)}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1 ml-6">
                  Create a local fork of this chain
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
      </DialogBody>
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
    className={`overflow-hidden p-3 border rounded-md ${isSelected ? "border-polkadot bg-polkadot/5" : "border-border"}`}
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
              ? "Light client for a decentralized experience"
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
