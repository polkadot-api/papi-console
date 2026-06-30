import { TokenAmount } from "@/components/TokenAmount"
import { client$ } from "@/state/chains/chain.state"
import {
  getAccountGenericAddress,
  getAccountPublicKey,
  selectedAccount$,
} from "@/state/polkahub"
import { polkadot_people } from "@polkadot-api/descriptors"
import {
  liftSuspense,
  state,
  SUSPENSE,
  useStateObservable,
} from "@react-rxjs/core"
import { switchMapSuspended } from "@react-rxjs/utils"
import { CheckCircle, CircleX, Loader2 } from "lucide-react"
import { FC, ReactNode } from "react"
import {
  catchError,
  combineLatest,
  map,
  of,
  startWith,
  switchMap,
  timer,
} from "rxjs"
import { transaction$, txOptions$ } from "./submit.state"
import { validate$ } from "./validate"

const accountBalance$ = state(
  combineLatest([selectedAccount$, client$]).pipe(
    switchMapSuspended(([account, client]) =>
      account
        ? client
            .getTypedApi(polkadot_people)
            .query.System.Account.getValue(getAccountGenericAddress(account))
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

export const paymentInfo$ = state(
  combineLatest([transaction$, selectedAccount$, txOptions$]).pipe(
    switchMapSuspended(([tx, account, txOptions]) => {
      if (!tx || !account) return [null]

      // Adding a small delay for debouncing quick input changes
      return timer(200).pipe(
        switchMap(() =>
          tx.getPaymentInfo(getAccountPublicKey(account), txOptions),
        ),
        catchError((ex) => {
          console.error(ex)
          return of(null)
        }),
      )
    }),
    liftSuspense(),
    map((v) => (v === SUSPENSE ? null : v)),
  ),
  null,
)

export const txValidity$ = state(
  combineLatest({
    tx: transaction$,
    txOptions: txOptions$,
  }).pipe(
    switchMapSuspended(({ tx, txOptions }) =>
      tx
        ? timer(500).pipe(
            // Revalidate every time selectedAccount changes, with no delay
            switchMap(() => selectedAccount$),
            switchMap(() => validate$(tx, txOptions).pipe(startWith(null))),
          )
        : [null],
    ),
    liftSuspense(),
    map((v) => (v === SUSPENSE ? null : v)),
  ),
  null,
)

export const Estimates: FC = () => {
  const paymentInfo = useStateObservable(paymentInfo$)
  const balance = useStateObservable(accountBalance$)
  const validity = useStateObservable(txValidity$)

  const loader = <Loader2 className="h-4 w-4 animate-spin" />
  const renderValidity = () => {
    if (!validity) return loader
    if (validity.type === "valid") {
      return (
        <div className="flex items-center gap-1 font-sans">
          Valid
          <CheckCircle size={20} className="text-green-600" />
        </div>
      )
    }
    if (validity.type === "invalid") {
      return (
        <div className="flex items-center gap-1 font-sans">
          {`Invalid: ${validity.value}`}
          <CircleX size={20} className="text-red-400" />
        </div>
      )
    }
    return "N/A"
  }

  return (
    <section className="mx-4 space-y-3 border-t border-border py-4">
      <h3 className="text-sm font-medium">Submission</h3>
      <EstimateRow
        label="Estimated fee"
        value={
          paymentInfo ? (
            <TokenAmount>{paymentInfo.partial_fee}</TokenAmount>
          ) : (
            loader
          )
        }
      />
      <EstimateRow
        label="Account spendable balance"
        value={balance == null ? loader : <TokenAmount>{balance}</TokenAmount>}
      />
      <EstimateRow label="Validity" value={renderValidity()} />
    </section>
  )
}

const EstimateRow: FC<{ label: string; value: ReactNode }> = ({
  label,
  value,
}) => (
  <div className="flex items-start justify-between gap-3 py-1.5">
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className="text-right font-mono text-sm">{value}</span>
  </div>
)

const maxBigInt = (a: bigint, b: bigint) => (a > b ? a : b)
