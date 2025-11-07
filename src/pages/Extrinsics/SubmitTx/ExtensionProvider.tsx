import { Label } from "@/components/ui/label"
import { TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  availableExtensions$,
  selectedExtensions$,
  toggleExtension,
} from "@/state/polkahub"
import { useStateObservable } from "@react-rxjs/core"

export const ExtensionProvider: React.FC = () => {
  const availableExtensions = useStateObservable(availableExtensions$)
  const selectedExtensions = new Set(useStateObservable(selectedExtensions$))

  return (
    <>
      <Label>Click on the provider name to toggle it:</Label>
      <TabsList>
        {availableExtensions.map((extensionName) => (
          <TabsTrigger
            className="mx-1"
            onClick={() => toggleExtension(extensionName)}
            active={selectedExtensions.has(extensionName)}
            key={extensionName}
          >
            {extensionName}
          </TabsTrigger>
        ))}
      </TabsList>
    </>
  )
}
