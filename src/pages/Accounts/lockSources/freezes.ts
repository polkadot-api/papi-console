// Frozen:
// Locks: Vesting, OpenGov `::set_lock(` `Balances.locks`

import { MultiAddress } from "@polkadot-api/descriptors"
import { Binary } from "polkadot-api"
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
  getRelayBlock,
  IdentifiedLock,
  UnlockAction,
  unsafeClient$,
} from "./common"

const LOCK_IDS = {
  vesting: Binary.toHex(Binary.fromText("vesting ")),
  convictionVoting: Binary.toHex(Binary.fromText("pyconvot")),
}

const getVestingActions$ = (
  accountId: string,
  amount: bigint,
): Observable<UnlockAction[]> =>
  unsafeClient$.pipe(
    switchMap(async ({ client, unsafeApi }) => ({
      unsafeApi,
      relayBlock: await getRelayBlock(client),
    })),
    switchMap(async ({ unsafeApi, relayBlock }) => {
      if (relayBlock == null) {
        throw new Error("Unable to get relay block number")
      }
      const vested = await unsafeApi.query.Vesting.Vesting.getValue(accountId)
      const vestLocked =
        vested
          ?.map((vest) => {
            const blockCount = relayBlock - vest.starting_block
            const unlockedAmount = BigInt(blockCount) * vest.per_block
            const lockedAmount = vest.locked - unlockedAmount
            return lockedAmount > 0 ? lockedAmount : 0n
          })
          .reduce((a, b) => a + b, 0n) ?? 0n

      return [
        {
          amount: amount - vestLocked,
          action: "Vest",
          tx: unsafeApi.tx.Vesting.vest(),
        },
      ]
    }),
    fallbackWhenError([]),
    startWith([]),
  )

const getConvictionVoteActions$ = (
  accountId: string,
): Observable<UnlockAction[]> =>
  unsafeClient$.pipe(
    switchMap(async ({ unsafeApi }) => {
      // TODO add actions for removing vote and unlocking
      // unsafeApi.constants.ConvictionVoting.VoteLockingPeriod(),
      const votingFor =
        await unsafeApi.query.ConvictionVoting.VotingFor.getEntries(accountId)

      const unlockableTracks = votingFor
        .map((vote) => {
          const [block, balance] = vote.value.value.prior
          return {
            track: vote.keyArgs[1],
            balance,
            block,
          }
        })
        .filter(({ block, balance }) => block > 123 && balance > 0)
      const unlockAmount = unlockableTracks.reduce(
        (acc, track) => acc + track.balance,
        0n,
      )
      const unlockAction = batch(
        unsafeApi,
        unlockableTracks.map(({ track }) =>
          unsafeApi.tx.ConvictionVoting.unlock({
            class: track,
            target: MultiAddress.Id(accountId),
          }),
        ),
      )

      return unlockAction
        ? [
            {
              action: "Unlock",
              amount: unlockAmount,
              tx: unlockAction,
            },
          ]
        : []
    }),
    fallbackWhenError([]),
    startWith([]),
  )

export const getFreezes$ = (accountId: string): Observable<IdentifiedLock[]> =>
  unsafeClient$.pipe(
    switchMap(({ unsafeApi }) =>
      unsafeApi.query.Balances.Locks.getValue(accountId),
    ),
    switchMap((locks) =>
      combineLatest(
        locks.map((lock): ObservableInput<IdentifiedLock> => {
          if (lock.id === LOCK_IDS.vesting) {
            return getVestingActions$(accountId, lock.amount).pipe(
              map((unlockable) => ({
                id: "Vesting",
                amount: lock.amount,
                unlockable,
              })),
            )
          }
          if (lock.id === LOCK_IDS.convictionVoting) {
            return getConvictionVoteActions$(accountId).pipe(
              map((unlockable) => ({
                id: "OpenGov",
                amount: lock.amount,
                unlockable,
              })),
            )
          }
          return [
            {
              id: Binary.toText(Binary.fromHex(lock.id)).trim(),
              amount: lock.amount,
              unlockable: [],
            },
          ]
        }),
      ),
    ),
  )
