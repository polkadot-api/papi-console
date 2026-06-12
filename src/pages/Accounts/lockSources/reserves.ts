/*
Reserved:
Reserves: Assets, Bounties, ChildBounties, Identity, Multisig, Nfts, Proxy, Referenda, Staking  `::reserve(`
*/

import { shortStr } from "@/utils"
import { DotAh } from "@polkadot-api/descriptors"
import { getExtrinsicDecoder } from "@polkadot-api/tx-utils"
import { HexString, PolkadotClient, TypedApi } from "polkadot-api"
import { combineLatest, map, Observable, startWith, switchMap } from "rxjs"
import { fallbackWhenError, IdentifiedLock, unsafeClient$ } from "./common"
import { createTimedCache } from "./timedCache"

const multisigCache = createTimedCache((unsafeApi) =>
  unsafeApi.query.Multisig.Multisigs.getEntries(),
)

const getMultisigUnlockable = async (
  client: PolkadotClient,
  unsafeApi: TypedApi<DotAh, false>,
  deposit: bigint,
  call_hash: HexString,
  timepoint: {
    height: number
    index: number
  },
) => {
  try {
    const [hash] = await client._request("archive_v1_hashByHeight", [
      timepoint.height,
    ])
    const [body, metadata] = await Promise.all([
      client.getBlockBody(hash),
      client.getMetadata(hash),
    ])
    const decoder = getExtrinsicDecoder(metadata)
    const tx = decoder(body[timepoint.index])
    if (tx.call.type !== "Multisig")
      throw new Error("Target call not a multisig")
    return {
      action: `Cancel call ${shortStr(call_hash, 6)}`,
      amount: deposit,
      tx: unsafeApi.tx.Multisig.cancel_as_multi({
        call_hash,
        other_signatories: tx.call.value.value.other_signatories,
        threshold: tx.call.value.value.threshold,
        timepoint,
      }),
    }
  } catch (ex) {
    console.error(ex)
    return {
      action: `Cancel call ${shortStr(call_hash, 6)}`,
      amount: deposit,
      warn: "Can't access other signatories",
      tx: null,
    }
  }
}

const multisigSource$ = (
  accountId: string,
): Observable<IdentifiedLock | null> =>
  unsafeClient$.pipe(
    switchMap(async ({ client, unsafeApi }) => {
      const multisigs = await multisigCache(client)
      const ownMultisigs = multisigs.filter(
        ({ value }) => value.depositor === accountId,
      )

      if (!ownMultisigs.length) return null

      const totalAmount = ownMultisigs
        .map((v) => v.value.deposit)
        .reduce((acc, v) => acc + v)
      const unlockable = await Promise.all(
        ownMultisigs.map(({ keyArgs, value }) =>
          getMultisigUnlockable(
            client,
            unsafeApi,
            value.deposit,
            keyArgs[1],
            value.when,
          ),
        ),
      )
      return {
        id: "Multisig",
        amount: totalAmount,
        unlockable,
      }
    }),
  )

const reserveSources = [multisigSource$]

export const getReserves$ = (accountId: string, totalReserves: bigint) =>
  combineLatest(
    reserveSources.map((source) =>
      source(accountId).pipe(fallbackWhenError([]), startWith(null)),
    ),
  ).pipe(
    map((sourceResults) => {
      const completedResults = sourceResults.filter((r) => r !== null)

      const totalIdentified = completedResults.reduce(
        (acc, v) => acc + v.amount,
        0n,
      )
      if (totalIdentified < totalReserves) {
        completedResults.push({
          id: "Unknown reserved",
          amount: totalReserves - totalIdentified,
          unlockable: [],
        })
      }
      return completedResults
    }),
  )
