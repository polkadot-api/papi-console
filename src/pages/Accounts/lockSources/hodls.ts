// HODLL!!!!!!
// Reserved:
// Holds: Contracts, DelegatedStaking, Preimage `::hold(` `Balances.holds`

import { shortStr } from "@/utils"
import {
  combineLatest,
  map,
  Observable,
  ObservableInput,
  startWith,
  switchMap,
} from "rxjs"
import {
  batch,
  fallbackWhenError,
  IdentifiedLock,
  UnlockAction,
  unsafeClient$,
} from "./common"
import { createTimedCache } from "./timedCache"

const preimageCache = createTimedCache(async (unsafeApi) => {
  const [statusFor, requestStatusFor] = await Promise.all([
    unsafeApi.query.Preimage.StatusFor.getEntries(),
    unsafeApi.query.Preimage.RequestStatusFor.getEntries(),
  ])
  return [
    ...statusFor.map(({ keyArgs, value }) => ({
      hash: keyArgs[0],
      depositor: value.value.deposit?.[0],
      deposit: value.value.deposit?.[1],
      len: value.value.len,
    })),
    ...requestStatusFor.map(({ keyArgs, value }) =>
      value.type === "Requested"
        ? {
            hash: keyArgs[0],
            depositor: value.value.maybe_ticket?.[0],
            deposit: value.value.maybe_ticket?.[1],
            len: undefined,
          }
        : {
            hash: keyArgs[0],
            depositor: value.value.ticket[0],
            deposit: value.value.ticket[1],
            len: value.value.len,
          },
    ),
  ]
})
const getPreimageActions$ = (accountId: string): Observable<UnlockAction[]> =>
  unsafeClient$.pipe(
    switchMap(async ({ client, unsafeApi }) => {
      const preimages = await preimageCache(client)

      const ownPreimages = preimages.filter(
        ({ depositor }) => depositor === accountId,
      )
      const totalUnlockable = ownPreimages
        .map(({ deposit }) => deposit ?? 0n)
        .reduce((acc, v) => acc + v, 0n)

      const individualActions = ownPreimages.map(({ hash, deposit, len }) => ({
        action: `Remove ${shortStr(hash, 6)} len=${len ?? "N/A"}`,
        warn: "If this preimage is being used in a referendum or something else, removing the preimage will cause it to fail",
        amount: deposit ?? 0n,
        tx: unsafeApi.tx.Preimage.unnote_preimage({
          hash,
        }),
      }))
      const unoteAllTx = batch(
        unsafeApi,
        ownPreimages.map(({ hash }) =>
          unsafeApi.tx.Preimage.unnote_preimage({
            hash,
          }),
        ),
      )
      const unnoteAllAction = unoteAllTx
        ? {
            action: "Remove all",
            warn: "If any preimage is being used in a referendum or something else, removing the preimage will cause it to fail",
            amount: totalUnlockable,
            tx: unoteAllTx,
          }
        : null
      return [
        ...individualActions,
        ...(unnoteAllAction && individualActions.length > 1
          ? [unnoteAllAction]
          : []),
      ]
    }),
    fallbackWhenError([]),
    startWith([]),
  )

export const getHodls$ = (accountId: string): Observable<IdentifiedLock[]> =>
  unsafeClient$.pipe(
    switchMap(({ unsafeApi }) =>
      unsafeApi.query.Balances.Holds.getValue(accountId),
    ),
    switchMap((hodls) =>
      combineLatest(
        hodls.map((hodl): ObservableInput<IdentifiedLock> => {
          switch (hodl.id.type) {
            case "Preimage": {
              return getPreimageActions$(accountId).pipe(
                map((unlockable) => ({
                  id: "Preimage",
                  amount: hodl.amount,
                  unlockable,
                })),
              )
            }
          }

          return [
            {
              id: hodl.id.type,
              amount: hodl.amount,
              unlockable: [],
            },
          ]
        }),
      ),
    ),
  )
