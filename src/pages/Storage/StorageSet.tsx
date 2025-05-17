import { chopsticksInstance$ } from "@/chopsticks/chopsticks"
import { LookupTypeEdit } from "@/codec-components/LookupTypeEdit"
import { Chopsticks } from "@/components/Icons"
import { Button } from "@/components/ui/button"
import { lookup$ } from "@/state/chains/chain.state"
import { getTypeComplexity } from "@/utils"
import { setStorage } from "@acala-network/chopsticks-core"
import { toHex } from "@polkadot-api/utils"
import { useStateObservable } from "@react-rxjs/core"
import { FC, useState } from "react"
import { firstValueFrom } from "rxjs"
import { selectedEntry$ } from "./storage.state"
import { encodedKey$, KeyDisplay, StorageKeysInput } from "./StorageQuery"

export const StorageSet: FC = () => {
  const selectedEntry = useStateObservable(selectedEntry$)
  const lookup = useStateObservable(lookup$)
  const [value, setValue] = useState<Uint8Array | "partial" | null>(null)
  const encodedKey = useStateObservable(encodedKey$)
  const [isLoading, setIsLoading] = useState(false)

  if (!lookup || !selectedEntry) return null

  const shape = lookup(selectedEntry.value)
  const complexity = getTypeComplexity(shape)

  return (
    <div className="flex flex-col gap-4 items-start w-full overflow-hidden">
      <KeyDisplay />
      <StorageKeysInput disableToggle />
      <LookupTypeEdit
        className="w-full border rounded pt-2"
        type={selectedEntry.value}
        value={value}
        onValueChange={setValue}
        tree={complexity === "tree"}
      />
      <Button
        variant="secondary"
        disabled={isLoading || !encodedKey || !(value instanceof Uint8Array)}
        onClick={async () => {
          setIsLoading(true)
          try {
            const chopsticks = await firstValueFrom(chopsticksInstance$)
            if (!chopsticks || !encodedKey || !(value instanceof Uint8Array))
              return false

            await setStorage(chopsticks, [[encodedKey, toHex(value)]])
            await chopsticks.newBlock()
          } finally {
            setIsLoading(false)
          }
        }}
      >
        Set Storage
        <Chopsticks />
      </Button>
    </div>
  )
}
