import { Spinner } from "@/components/Icons"
import { Button } from "@/components/ui/button"
import {
  availableExtensions$,
  onToggleExtension,
  selectedExtensions$,
} from "@/state/extension-accounts.state"
// import { walletConnectStatus$ } from
import { cn } from "@/utils"
import { state, useStateObservable } from "@react-rxjs/core"
import { CircleQuestionMark, Eye } from "lucide-react"
import { FC, MouseEvent, PropsWithChildren } from "react"
import { defer, from, switchMap } from "rxjs"

const lazyWalletConnectStatus$ = state(
  defer(() =>
    from(import("@/state/walletconnect.state")).pipe(
      switchMap(({ walletConnectStatus$ }) => walletConnectStatus$),
    ),
  ),
  {
    type: "disconnected",
  },
)

export const knownExtensions: Record<string, { name: string; logo: string }> = {
  "polkadot-js": {
    name: "Polkadot JS",
    logo: import.meta.env.BASE_URL + "providers/polkadotjs.webp",
  },
  "nova-wallet": {
    name: "Nova Wallet",
    logo: import.meta.env.BASE_URL + "providers/novawallet.webp",
  },
  talisman: {
    name: "Talisman",
    logo: import.meta.env.BASE_URL + "providers/talisman.webp",
  },
  "subwallet-js": {
    name: "Subwallet",
    logo: import.meta.env.BASE_URL + "providers/subwallet.webp",
  },
}

export const Providers = () => {
  const availableExtensions = useStateObservable(availableExtensions$).sort(
    (a, b) => (b in knownExtensions ? 1 : 0) - (a in knownExtensions ? 1 : 0),
  )
  const walletConnectStatus = useStateObservable(lazyWalletConnectStatus$)

  return (
    <div className="p-4">
      <h3 className="text-xl font-bold">Account Providers</h3>
      <ul className="flex gap-2 flex-wrap items-center justify-center">
        {availableExtensions.map((id) => (
          <li key={id}>
            <ExtensionButton id={id} />
          </li>
        ))}

        <SourceButton label="Address">
          <div>
            <Eye className="size-10" />
          </div>
        </SourceButton>
        <SourceButton label="Ledger" disabled>
          <img
            src={import.meta.env.BASE_URL + "providers/ledger.webp"}
            alt="Ledger"
            className="h-10 rounded"
          />
        </SourceButton>
        <SourceButton label="Vault" disabled>
          <img
            src={import.meta.env.BASE_URL + "providers/vault.webp"}
            alt="Vault"
            className="h-10 rounded"
          />
        </SourceButton>
        <SourceButton
          label="Wallet Connect"
          isSelected={walletConnectStatus.type === "connected"}
          onClick={async () => {
            const { toggleWalletConnect } = await import(
              "@/state/walletconnect.state"
            )
            toggleWalletConnect()
          }}
        >
          {walletConnectStatus.type === "connecting" ? (
            <Spinner className="size-4 m-3 text-sky-500" />
          ) : (
            <img
              src={import.meta.env.BASE_URL + "providers/walletConnect.svg"}
              alt="Wallet Connect"
              className="h-10 rounded"
            />
          )}
        </SourceButton>
      </ul>
    </div>
  )
}

const ExtensionButton: FC<{
  id: string
}> = ({ id }) => {
  const knownExtension = knownExtensions[id]
  const connectedExtensions = Array.from(
    useStateObservable(selectedExtensions$).keys(),
  )
  const isSelected = connectedExtensions.includes(id)

  return (
    <SourceButton
      isSelected={isSelected}
      label={knownExtension?.name ?? id}
      onClick={() => onToggleExtension(id)}
    >
      {knownExtension ? (
        <img
          src={knownExtension.logo}
          alt={knownExtension.name}
          className="h-10 rounded"
        />
      ) : (
        <div>
          <CircleQuestionMark
            className="size-10 text-muted-foreground"
            strokeWidth={1}
          />
        </div>
      )}
    </SourceButton>
  )
}

const SourceButton: FC<
  PropsWithChildren<{
    label: string
    isSelected?: boolean
    className?: string
    onClick?: (evt: MouseEvent) => void
    disabled?: boolean
  }>
> = ({ label, isSelected, onClick, className, children, disabled }) => (
  <Button
    variant="outline"
    className={cn("h-auto min-w-40", isSelected ? "bg-accent" : "")}
    onClick={onClick}
    disabled={disabled}
    forceSvgSize={false}
  >
    {children}
    <div className="text-left">
      <span className={cn("font-bold", className)}>{label}</span>
    </div>
  </Button>
)
