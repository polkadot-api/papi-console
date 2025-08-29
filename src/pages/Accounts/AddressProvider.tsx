import { AccountIdDisplay } from "@/components/AccountIdDisplay"
import { AccountIdInput } from "@/components/AccountIdInput"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"
import { readOnlyAddresses$, setAddresses } from "@/state/accounts.state"
import { useStateObservable } from "@react-rxjs/core"
import { Eye, Trash2 } from "lucide-react"
import { SS58String } from "polkadot-api"
import { useState } from "react"
import { SourceButton } from "./SourceButton"

export const AddressProvider = () => (
  <Dialog>
    <DialogTrigger asChild>
      <SourceButton label="Address">
        <div>
          <Eye className="size-10" />
        </div>
      </SourceButton>
    </DialogTrigger>
    <DialogContent>
      <ManageAddresses />
    </DialogContent>
  </Dialog>
)

const ManageAddresses = () => {
  const [addressInput, setAddressInput] = useState<SS58String | null>(null)
  const readOnlyAddresses = useStateObservable(readOnlyAddresses$)

  return (
    <div className="space-y-4 overflow-hidden">
      <form
        onSubmit={(evt) => {
          evt.preventDefault()
          if (!addressInput) return

          setAddresses([
            ...readOnlyAddresses.filter((v) => v !== addressInput),
            addressInput,
          ])
          setAddressInput(null)
        }}
      >
        <h3 className="font-medium text-muted-foreground">
          Add read-only address
        </h3>
        <div className="flex gap-2 items-center">
          <AccountIdInput
            className="grow"
            value={addressInput}
            onValueChanged={setAddressInput}
          />
          <Button variant="secondary" disabled={!addressInput}>
            Add
          </Button>
        </div>
      </form>
      {readOnlyAddresses.length ? (
        <div>
          <h3 className="font-medium text-muted-foreground">Added addresses</h3>
          <ul className="space-y-3">
            {readOnlyAddresses.map((addr) => (
              <li key={addr} className="flex gap-2 items-center">
                <Button
                  variant="outline"
                  className="text-destructive border-destructive"
                  type="button"
                  onClick={() =>
                    setAddresses(readOnlyAddresses.filter((v) => addr !== v))
                  }
                >
                  <Trash2 />
                </Button>
                <AccountIdDisplay value={addr} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
