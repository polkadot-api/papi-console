import { state } from "@react-rxjs/core"
import { SS58String } from "polkadot-api"
import {
  catchError,
  combineLatest,
  filter,
  map,
  ObservedValueOf,
  of,
  switchMap,
} from "rxjs"
import { balance$ } from "./AccountList"
import { getFreezes$ } from "./lockSources/freezes"
import { getHodls$ } from "./lockSources/hodls"
import { getReserves$ } from "./lockSources/reserves"

const isNotNull = <T>(value: T | null): value is T => value !== null

export const accountLocks$ = state(
  (accountId: SS58String) =>
    balance$(accountId).pipe(
      filter(isNotNull),
      switchMap((balance) => {
        const freezes = balance.frozen ? getFreezes$(accountId) : of([])
        const reserves = balance.reserved
          ? getHodls$(accountId).pipe(
              switchMap((hodls) => {
                const totalReserves =
                  balance.reserved -
                  hodls.reduce((acc, v) => acc + v.amount, 0n)
                return totalReserves > 0n
                  ? getReserves$(accountId, totalReserves).pipe(
                      map((reserves) => [...hodls, ...reserves]),
                    )
                  : [hodls]
              }),
            )
          : of([])

        return combineLatest({ balance: of(balance), freezes, reserves })
      }),
      catchError((ex) => {
        console.error(ex)
        return [null]
      }),
    ),
  null,
)
export type AccountLocks = NonNullable<
  ObservedValueOf<ReturnType<typeof accountLocks$>>
>
