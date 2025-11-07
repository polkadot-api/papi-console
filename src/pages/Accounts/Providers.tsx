import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@polkahub/ui-components"
import { ChevronLeft } from "lucide-react"
import {
  ManageLedger,
  ManageReadOnly,
  ManageVault,
  ModalContext,
  PjsWalletButtons,
  usePolkaHubModalState,
  WalletConnectButton,
} from "polkahub"
import { FC, PropsWithChildren } from "react"

const ManageToDialog: FC<PropsWithChildren> = ({ children }) => {
  const { contentStack, contextValue, setContentStack } =
    usePolkaHubModalState()
  const activeContent = contentStack.length
    ? contentStack[contentStack.length - 1]
    : null

  return (
    <>
      <ModalContext value={contextValue}>{children}</ModalContext>
      <Dialog
        open={activeContent != null}
        onOpenChange={() => setContentStack([])}
      >
        <DialogContent
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
          <DialogHeader className="flex-row items-center">
            {contentStack.length > 1 ? (
              <Button
                className="has-[>svg]:px-1"
                type="button"
                variant="ghost"
                onClick={() => contextValue.popContent()}
              >
                <ChevronLeft />
              </Button>
            ) : null}
            <DialogTitle>{activeContent?.title}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <ModalContext value={contextValue}>
              {activeContent?.element}
            </ModalContext>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  )
}

export const Providers = () => (
  <div className="bg-card p-4 rounded-xl space-y-2">
    <h3 className="text-xl font-bold">Account Providers</h3>
    <PjsWalletButtons />
    <ManageToDialog>
      <ul className="flex gap-2 flex-wrap items-center justify-center">
        <ManageReadOnly />
        <ManageLedger />
        <ManageVault />
        <WalletConnectButton />
      </ul>
    </ManageToDialog>
  </div>
)
