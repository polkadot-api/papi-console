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
import { FC, ReactNode } from "react"
import { catchError, combineLatest, map, of, switchMap, timer } from "rxjs"
import { transaction$, txOptions$ } from "./submit.state"

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

export const Estimates: FC = () => {
  const paymentInfo = useStateObservable(paymentInfo$)
  const balance = useStateObservable(accountBalance$)

  return (
    <section className="mx-4 space-y-3 border-t border-border py-4">
      <h3 className="text-sm font-medium">Submission</h3>
      <EstimateRow
        label="Estimated fee"
        value={
          paymentInfo ? (
            <TokenAmount>{paymentInfo.partial_fee}</TokenAmount>
          ) : (
            "…"
          )
        }
      />
      <EstimateRow
        label="Account spendable balance"
        value={balance == null ? "…" : <TokenAmount>{balance}</TokenAmount>}
      />
    </section>
  )
}

const EstimateRow: FC<{ label: string; value: ReactNode }> = ({
  label,
  value,
}) => (
  <div className="flex items-top justify-between gap-3 py-1.5">
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className="text-right font-mono text-sm">{value}</span>
  </div>
)

const maxBigInt = (a: bigint, b: bigint) => (a > b ? a : b)
