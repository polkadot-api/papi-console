import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
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
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Network,
  networkCategories,
  onChangeChain,
  SelectedChain,
  selectedChain$,
} from "@/state/chains/chain.state"
import { useStateObservable } from "@react-rxjs/core"
import { useCommandState } from "cmdk"
import { Check, ChevronDown } from "lucide-react"
import { FC, useEffect, useRef, useState } from "react"

const isValidUri = (input: string): boolean => {
  try {
    new URL(input)
  } catch {
    return false
  }
  return true
}

const EmptyOption: React.FC<{
  enteredText: string
  selectedNetwork: Network
  selectedRpc: string
  setSelectedNetwork: React.Dispatch<React.SetStateAction<Network>>
  setSelectedRpc: React.Dispatch<React.SetStateAction<string>>
}> = (props) =>
  useCommandState((x) => x.filtered.count) ? null : <Empty {...props} />

const Empty: React.FC<{
  enteredText: string
  selectedNetwork: Network
  selectedRpc: string
  setSelectedNetwork: React.Dispatch<React.SetStateAction<Network>>
  setSelectedRpc: React.Dispatch<React.SetStateAction<string>>
}> = ({
  enteredText,
  selectedNetwork,
  selectedRpc,
  setSelectedNetwork,
  setSelectedRpc,
}) => {
  const initialValue = useRef({
    selectedNetwork,
    selectedRpc,
  })
  const isValid = isValidUri(enteredText)
  useEffect(() => {
    setSelectedNetwork({
      id: "custom-network",
      lightclient: false,
      endpoints: { custom: enteredText },
      display: enteredText,
    })
    setSelectedRpc(isValid ? enteredText : "")
    return () => {
      if (!isValid) {
        setSelectedNetwork(initialValue.current.selectedNetwork)
        setSelectedRpc(initialValue.current.selectedRpc)
      }
    }
  }, [enteredText, isValid])
  return isValid ? (
    <div className="relative flex cursor-default gap-2 select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none data-[disabled=true]:pointer-events-none data-[selected='true']:bg-accent data-[selected=true]:text-accent-foreground data-[disabled=true]:opacity-50">
      <Check className="mr-2 h-4 w-4 opacity-100" />
      {enteredText}
    </div>
  ) : (
    <CommandEmpty>No networks found.</CommandEmpty>
  )
}

export function NetworkSwitcher() {
  const [open, setOpen] = useState(false)
  const selectedChain = useStateObservable(selectedChain$)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="w-[100px] lg:w-[200px] flex gap-0 justify-between text-base px-3 border border-border bg-input"
        >
          <span className="overflow-hidden text-ellipsis">
            {selectedChain.network.display}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DialogTrigger>
      <NetworkSwitchDialogContent
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
    onChangeChain({
      network: selectedNetwork,
      endpoint: selectedRpc,
    })
    onClose()
  }

  return (
    <DialogContent className="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>Switch Network</DialogTitle>
      </DialogHeader>
      <Command className="rounded-lg border shadow-md">
        <CommandInput
          placeholder="Search or enter a custom URI"
          value={enteredText}
          onValueChange={setEnteredText}
        />
        <CommandList>
          <EmptyOption
            {...{
              enteredText,
              selectedNetwork,
              selectedRpc,
              setSelectedRpc,
              setSelectedNetwork,
            }}
          />
          <ScrollArea className="h-[260px]">
            {networkCategories.map((category) => (
              <CommandGroup key={category.name} heading={category.name}>
                {category.networks.map((network) => (
                  <CommandItem
                    key={network.id}
                    onSelect={() => handleNetworkSelect(network)}
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
              </CommandGroup>
            ))}
          </ScrollArea>
        </CommandList>
      </Command>
      {selectedNetwork && selectedNetwork.id !== "custom-network" && (
        <Accordion type="single" collapsible className="w-full -mt-3">
          <AccordionItem value="connection-options">
            <AccordionTrigger>Connection Options</AccordionTrigger>
            <AccordionContent>
              <ScrollArea className="h-[155px] rounded-lg border p-2">
                <RadioGroup>
                  {selectedNetwork.lightclient ? (
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem
                        value="light-client"
                        id="light-client"
                        checked={selectedRpc === "light-client"}
                        onClick={() => setSelectedRpc("light-client")}
                      />
                      <Label htmlFor="light-client">
                        Light Client (smoldot)
                      </Label>
                    </div>
                  ) : null}
                  {Object.entries(selectedNetwork.endpoints).map(
                    ([rpcName, url]) => (
                      <div key={url} className="flex items-center space-x-2">
                        <RadioGroupItem
                          value={url}
                          id={url}
                          checked={selectedRpc === url}
                          onClick={() => setSelectedRpc(url)}
                        />
                        <Label htmlFor={url}>{rpcName}</Label>
                      </div>
                    ),
                  )}
                </RadioGroup>
              </ScrollArea>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
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
