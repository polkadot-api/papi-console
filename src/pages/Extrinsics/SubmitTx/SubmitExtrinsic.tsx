import { ActionButton } from "@/components/ActionButton"
import { Spinner } from "@/components/Icons"
import { TokenAmount } from "@/components/TokenAmount"
import { Dialog, DialogTrigger } from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createState } from "@/lib/externalState"
import { PolkahubModalBasedManagers } from "@/pages/Accounts/Providers"
import { client$, unsafeApi$ } from "@/state/chains/chain.state"
import { selectedAccount$ } from "@/state/polkahub"
import { polkadot_people } from "@polkadot-api/descriptors"
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
} from "@react-rxjs/core"
import {
  createSignal,
  mergeWithKey,
  switchMapSuspended,
} from "@react-rxjs/utils"
import { ChevronLeft, Send, Settings, WalletCards } from "lucide-react"
import { AccountId, TxOptions } from "polkadot-api"
import {
  ModalContext,
  PjsWalletButtons,
  usePolkaHubModalState,
  useSelectedAccount,
} from "polkahub"
import { FC, forwardRef, ReactNode, useState } from "react"
import {
  catchError,
  combineLatest,
  defer,
  map,
  scan,
  switchMap,
  timer,
} from "rxjs"
import { callData$ } from "../componentValue.state"
import { CustomSignedExt, customSignedExtensions$ } from "../CustomSignedExt"
import { trackTx } from "../ExtrinsicsWorkspaceEntry"
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

const [nonceChanged$, setNonce] = createSignal<string>()
const [nonceBlurred$, blurNonce] = createSignal()
const chainNonce$ = unsafeApi$.pipe(
  switchMapSuspended((api) =>
    selectedAccount$.pipe(
      switchMapSuspended((account) => {
        if (account) console.log(account.address)
        if (account?.signer)
          console.log(account, AccountId(0).dec(account.signer.publicKey))

        return account?.signer
          ? api.apis.AccountNonceApi.account_nonce(
              AccountId(42).dec(account.signer.publicKey),
              {
                at: "best",
              },
            )
          : []
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
)
const isIntegerStr = (str: string) => /^\d+$/.test(str)
const nonce$ = state(
  defer(() =>
    mergeWithKey({
      chainNonce$,
      nonceChanged$,
      nonceBlurred$,
    }).pipe(
      scan(
        (
          acc: {
            chain: number | null
            inputValue: string
          },
          v,
        ) => {
          switch (v.type) {
            case "chainNonce$":
              if (v.payload != null)
                return { chain: v.payload, inputValue: v.payload.toString() }
              break
            case "nonceBlurred$":
              if (!isIntegerStr(acc.inputValue)) {
                return {
                  chain: acc.chain,
                  inputValue: acc.chain?.toString() ?? "",
                }
              }
              break
            case "nonceChanged$":
              return { chain: acc.chain, inputValue: v.payload }
          }
          return acc
        },
        { chain: null, inputValue: "" },
      ),
      map((v) => v.inputValue),
    ),
  ),
  "",
)

type Mortality = NonNullable<TxOptions<any, any>["mortality"]>
const DEFAULT_MORTAL = {
  mortal: true,
  period: 64,
}
// powers of 2 from 4 to 16 (incl)
const periodOptions = new Array(16 - 4 + 1).fill(0).map((_, i) => 1 << (i + 4))
const [mortality$, setMortality] = createState<Mortality>(DEFAULT_MORTAL)
const [tip$, setTip] = createState("0")

const transaction$ = state(
  combineLatest([unsafeApi$, callData$]).pipe(
    switchMapSuspended(([unsafeApi, callData]) =>
      callData ? unsafeApi.txFromCallData(callData) : [null],
    ),
    liftSuspense(),
    map((v) => (v === SUSPENSE ? null : v)),
  ),
  null,
)

const txOptions$ = state(
  combineLatest([
    nonce$.pipe(map((v) => (isIntegerStr(v) ? Number(v) : null))),
    mortality$,
    tip$.pipe(map((v) => (isIntegerStr(v) ? BigInt(v) : null))),
    customSignedExtensions$,
  ]).pipe(
    map(([nonce, mortality, tip, signedExt]): TxOptions<any, any> => {
      return {
        mortality,
        nonce: nonce ?? undefined,
        tip: tip ?? undefined,
        customSignedExtensions: signedExt,
      }
    }),
  ),
  {} satisfies TxOptions<any, any>,
)

const paymentInfo$ = state(
  combineLatest([transaction$, selectedAccount$, txOptions$]).pipe(
    switchMapSuspended(([tx, account, txOptions]) => {
      if (!tx || !account?.signer) return [null]

      // Adding a small delay for debouncing quick input changes
      return timer(200).pipe(
        switchMap(() =>
          tx.getPaymentInfo(account.signer!.publicKey, txOptions),
        ),
      )
    }),
    liftSuspense(),
    map((v) => (v === SUSPENSE ? null : v)),
  ),
  null,
)

const accountBalance$ = state(
  combineLatest([selectedAccount$, client$]).pipe(
    switchMapSuspended(([account, client]) =>
      account?.signer
        ? client
            .getTypedApi(polkadot_people)
            .query.System.Account.getValue(
              AccountId().dec(account.signer.publicKey),
            )
        : [],
    ),
    liftSuspense(),
    map((v) => (v === SUSPENSE ? null : v)),
    map((v) => {
      if (!v) return null
      const { reserved, free, frozen } = v.data
      const total = reserved + free

      // TODO ED
      const untouchable = total == 0n ? 0n : maxBigInt(frozen - reserved, 0n)

      return free - untouchable
    }),
  ),
  null,
)

export const SubmitExtrinsic = forwardRef<HTMLElement>((_, ref) => {
  const [account] = useSelectedAccount()
  const nonce = useStateObservable(nonce$)
  const mortality = useStateObservable(mortality$)
  const tip = useStateObservable(tip$)
  const paymentInfo = useStateObservable(paymentInfo$)
  const balance = useStateObservable(accountBalance$)
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

      <section className="mx-4 space-y-3 border-t border-border py-4">
        <h3 className="text-sm font-medium">Fees</h3>
        <FeeRow
          label="Estimated fee"
          value={
            paymentInfo ? (
              <TokenAmount>{paymentInfo.partial_fee}</TokenAmount>
            ) : (
              "…"
            )
          }
        />
        <FeeRow
          label="Account spendable balance"
          value={balance == null ? "…" : <TokenAmount>{balance}</TokenAmount>}
        />
      </section>

      <section className="mx-4 space-y-3 border-t border-border py-4">
        <ActionButton
          className="flex w-full items-center justify-center gap-2 rounded-md py-2.5 text-sm font-semibold"
          disabled={!account || isSigning}
          onClick={signAndSubmit}
        >
          <Send className="h-4 w-4" />
          Sign & Submit
          {isSigning && <Spinner size={16} />}
        </ActionButton>

        <ActionButton
          className="flex w-full items-center justify-center gap-2 rounded-md border border-border bg-background py-2.5 text-sm font-semibold text-foreground hover:bg-foreground/5"
          onClick={submitUnsigned}
          disabled={!account || isSigning}
        >
          Submit without signing
        </ActionButton>
      </section>
    </aside>
  )
})

const SignerSetupDialog: FC = () => {
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

const FeeRow: FC<{ label: string; value: ReactNode }> = ({ label, value }) => (
  <div className="flex items-center justify-between gap-3 py-1.5">
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className="text-right font-mono text-sm">{value}</span>
  </div>
)
const maxBigInt = (a: bigint, b: bigint) => (a > b ? a : b)
