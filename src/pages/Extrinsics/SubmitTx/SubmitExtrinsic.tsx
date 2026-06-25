import { ActionButton } from "@/components/ActionButton"
import { Spinner } from "@/components/Icons"
import { Dialog, DialogTrigger } from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PolkahubModalBasedManagers } from "@/pages/Accounts/Providers"
import { unsafeApi$ } from "@/state/chains/chain.state"
import { getAccountGenericAddress, selectedAccount$ } from "@/state/polkahub"
import {
  Button,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
} from "@polkahub/ui-components"
import {
  liftSuspense,
  state,
  SUSPENSE,
  useStateObservable,
  withDefault,
} from "@react-rxjs/core"
import { switchMapSuspended } from "@react-rxjs/utils"
import { ChevronLeft, Send, Settings, WalletCards } from "lucide-react"
import {
  ModalContext,
  PjsWalletButtons,
  usePolkaHubModalState,
  useSelectedAccount,
} from "polkahub"
import { FC, forwardRef, ReactNode, useState } from "react"
import { catchError, map, switchMap, timer } from "rxjs"
import { CustomSignedExt, customSignedExtensions$ } from "../CustomSignedExt"
import { trackTx } from "../ExtrinsicsWorkspaceEntry"
import { DryRun, Estimates } from "./Estimates"
import {
  blurNonce,
  DEFAULT_MORTAL,
  mortality$,
  nonce$,
  setMortality,
  setNonce,
  setTip,
  tip$,
  transaction$,
  txOptions$,
} from "./submit.state"
import { SelectAccount } from "./SubmitTxForm"

const customExtensionsCount$ = state(
  customSignedExtensions$.pipe(
    map((v) => Object.keys(v).length),
    map((v) =>
      v ? (
        <div className="px-1.5 rounded-full bg-chart-1 text-white text-sm">
          {v}
        </div>
      ) : null,
    ),
  ),
  null,
)

// powers of 2 from 4 to 16 (incl)
const periodOptions = new Array(16 - 4 + 1).fill(0).map((_, i) => 1 << (i + 4))

const chainNonce$ = unsafeApi$.pipeState(
  switchMapSuspended((api) =>
    selectedAccount$.pipe(
      switchMapSuspended((account) => {
        const address = account && getAccountGenericAddress(account)
        return address
          ? timer(0, 60_000).pipe(
              switchMap(() => api.apis.AccountNonceApi.account_nonce(address)),
            )
          : [null]
      }),
      liftSuspense(),
      catchError((ex) => {
        console.error(ex)
        return []
      }),
    ),
  ),
  liftSuspense(),
  map((v) => (v === SUSPENSE ? null : (v as number))),
  withDefault(null),
)

export const SubmitExtrinsic = forwardRef<HTMLElement>((_, ref) => {
  const [account] = useSelectedAccount()
  const chainNonce = useStateObservable(chainNonce$)
  const nonce = useStateObservable(nonce$)
  const mortality = useStateObservable(mortality$)
  const tip = useStateObservable(tip$)
  const tx = useStateObservable(transaction$)
  const txOptions = useStateObservable(txOptions$)
  const [isSigning, setIsSigning] = useState(false)

  const signAndSubmit = async () => {
    if (!account?.signer || !tx) return

    setIsSigning(true)
    try {
      const signedExtrinsic = await tx.sign(account.signer, txOptions)
      trackTx(signedExtrinsic, tx.decodedCall, account)
    } catch (ex) {
      console.error(ex)
    }
    setIsSigning(false)
  }
  const submitUnsigned = async () => {
    if (!tx) return

    setIsSigning(true)
    try {
      const extrinsic = await tx.getBareTx()
      trackTx(extrinsic, tx.decodedCall)
    } catch (ex) {
      console.error(ex)
    }
    setIsSigning(false)
  }

  return (
    <aside
      ref={ref}
      className="mx-auto max-w-md overflow-auto rounded-lg border border-border bg-background shadow-sm @4xl:mx-0 @4xl:w-full @4xl:rounded-none @4xl:border-y-0 @4xl:border-r-0 @4xl:shadow-none"
    >
      <div className="px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Submit
        </h2>
      </div>

      <section className="mx-4 space-y-3 border-t border-border py-4">
        <SubmitRow label="Signer">
          <div className="flex gap-2 items-center">
            <SelectAccount />
            <SignerSetupDialog />
          </div>
        </SubmitRow>

        <SubmitRow label="Nonce">
          <Input
            type="number"
            min={0}
            value={nonce}
            placeholder={chainNonce?.toString()}
            onChange={(evt) => setNonce(evt.target.value)}
            onBlur={blurNonce}
            className="tabular-nums"
          />
        </SubmitRow>

        <SubmitRow label="Mortality">
          <div className="flex-1 flex items-center rounded focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
            <Select
              value={mortality.mortal ? "mortal" : "immortal"}
              onValueChange={(v) =>
                setMortality(
                  v === "mortal" ? DEFAULT_MORTAL : { mortal: false },
                )
              }
            >
              <SelectTrigger className="flex-2 focus:ring-0 not-last:rounded-r-none not-last:border-r-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mortal">Mortal</SelectItem>
                <SelectItem value="immortal">Immortal</SelectItem>
              </SelectContent>
            </Select>
            {mortality.mortal ? (
              <Select
                value={mortality.period.toString()}
                onValueChange={(v) =>
                  setMortality({ mortal: true, period: Number(v) })
                }
              >
                <SelectTrigger className="flex-1 focus:ring-0 rounded-l-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {periodOptions.map((period) => (
                    <SelectItem key={period} value={period.toString()}>
                      {period} blocks
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </div>
        </SubmitRow>

        <SubmitRow label="Tip">
          <div className="flex-1 flex items-center gap-2">
            <Input
              type="number"
              min={0}
              value={tip}
              onChange={(evt) => setTip(evt.target.value)}
              className="font-mono"
            />
            <p>Planck</p>
          </div>
        </SubmitRow>

        <CustomSignedExtDialog />
      </section>

      <Estimates />

      <section className="mx-4 space-y-3 border-t border-border py-4">
        <DryRun />

        <ActionButton
          className="flex w-full items-center justify-center gap-2 rounded-md py-2.5 text-sm font-semibold"
          disabled={!tx || !account?.signer || isSigning}
          onClick={signAndSubmit}
        >
          <Send className="h-4 w-4" />
          Sign & Submit
          {isSigning && <Spinner size={16} />}
        </ActionButton>

        <ActionButton
          className="flex w-full items-center justify-center gap-2 rounded-md border border-border bg-background py-2.5 text-sm font-semibold text-foreground hover:bg-foreground/5"
          onClick={submitUnsigned}
          disabled={!tx || isSigning}
        >
          Submit without signing
        </ActionButton>
      </section>
    </aside>
  )
})

export const SignerSetupDialog: FC = () => {
  const [open, setOpen] = useState(false)

  const { contentStack, contextValue } = usePolkaHubModalState(() =>
    setOpen(false),
  )
  const activeContent = contentStack.length
    ? contentStack[contentStack.length - 1]
    : null

  return (
    <Dialog
      open={open}
      onOpenChange={(open) =>
        open ? setOpen(true) : contextValue.closeModal()
      }
    >
      <DialogTrigger asChild>
        <button
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-background hover:bg-foreground/5"
          type="button"
          aria-label="Configure signers"
        >
          <WalletCards className="h-4 w-4" />
        </button>
      </DialogTrigger>
      <DialogContent
        onInteractOutside={(evt) => {
          if (
            evt.target instanceof HTMLElement &&
            evt.target.tagName === "WCM-MODAL"
          )
            evt.preventDefault()
        }}
      >
        <DialogHeader className="flex-row items-center">
          {contentStack.length ? (
            <Button
              className="has-[>svg]:px-1"
              type="button"
              variant="ghost"
              onClick={() => contextValue.popContent()}
            >
              <ChevronLeft />
            </Button>
          ) : null}
          <DialogTitle>{activeContent?.title ?? "Signers"}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <ModalContext value={contextValue}>
            {activeContent ? (
              activeContent.element
            ) : (
              <div className="space-y-4">
                <SelectAccount />
                <PjsWalletButtons />
                <PolkahubModalBasedManagers />
              </div>
            )}
          </ModalContext>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}

const CustomSignedExtDialog: FC = () => {
  const customExtensionsCount = useStateObservable(customExtensionsCount$)

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          className="flex w-full items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-left text-sm hover:bg-foreground/5"
          type="button"
        >
          <Settings className="h-4 w-4" />
          Custom extensions
          {customExtensionsCount ? (
            <span className="ml-auto">{customExtensionsCount}</span>
          ) : null}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Custom Signed Extensions</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <CustomSignedExt />
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}

const SubmitRow: FC<{
  label: string
  children: ReactNode
}> = ({ label, children }) => (
  <div className={`grid grid-cols-[4.75rem_minmax(0,1fr)] gap-3 items-center`}>
    <div className="text-sm font-medium text-muted-foreground">{label}</div>
    {children}
  </div>
)
