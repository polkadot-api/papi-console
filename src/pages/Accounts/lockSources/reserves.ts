/*
Reserved:
Reserves: Assets, Bounties, ChildBounties, Identity, Multisig, Nfts, Proxy, Referenda  `::reserve(`
*/

import { shortStr } from "@/utils"
import { DotAh, MultiAddress } from "@polkadot-api/descriptors"
import { getExtrinsicDecoder } from "@polkadot-api/tx-utils"
import { HexString, PolkadotClient, TypedApi } from "polkadot-api"
import {
  combineLatest,
  from,
  map,
  Observable,
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

// Assets
const assetCache = createTimedCache((unsafeApi) =>
  unsafeApi.query.Assets.Asset.getEntries(),
)
const assetSource$ = (accountId: string): Observable<IdentifiedLock | null> =>
  unsafeClient$.pipe(
    switchMap(async ({ client, unsafeApi }) => {
      const assets = await assetCache(client)
      const ownAssets = assets.filter(
        (asset) => asset.value.owner === accountId,
      )
      if (!ownAssets.length) return null

      const actions = ownAssets.map(
        (asset): UnlockAction => ({
          action: `Clear metadata ${asset.keyArgs[0]}`,
          amount: asset.value.deposit,
          tx:
            asset.value.status.type === "Live"
              ? unsafeApi.tx.Assets.clear_metadata({ id: asset.keyArgs[0] })
              : null,
          warn:
            asset.value.status.type === "Live"
              ? undefined
              : "Can't clear: Asset not live",
        }),
      )
      const unlockable = actions.filter((v) => !!v.tx)
      if (unlockable.length > 1) {
        actions.push({
          action: "Clear all",
          amount: unlockable.reduce((acc, v) => acc + v.amount, 0n),
          tx: batch(
            unsafeApi,
            unlockable.map((v) => v.tx!),
          )!,
        })
      }

      return {
        id: "Assets",
        amount: actions.reduce((acc, v) => acc + v.amount, 0n),
        unlockable: actions,
      }
    }),
  )

// Bounties
const bountyCache = createTimedCache((unsafeApi) =>
  unsafeApi.query.Bounties.Bounties.getEntries(),
)
const bountySource$ = (accountId: string): Observable<IdentifiedLock | null> =>
  unsafeClient$.pipe(
    switchMap(async ({ client }) => {
      const bounties = await bountyCache(client)
      const ownBounties = bounties
        .map(({ value, keyArgs }): UnlockAction | null => {
          let amount = 0n
          if (value.proposer === accountId) {
            amount += value.bond
          }
          if (
            value.status.value &&
            "curator" in value.status.value &&
            value.status.value.curator === accountId
          ) {
            amount += value.curator_deposit
          }
          // TODO implement action(s)
          return amount == 0n
            ? null
            : {
                action: `Bounty ${keyArgs}`,
                amount,
                tx: null,
              }
        })
        .filter((v) => v !== null)
      if (!ownBounties.length) return null

      return {
        id: "Bounties",
        amount: ownBounties.reduce((acc, v) => acc + v.amount, 0n),
        unlockable: ownBounties,
      }
    }),
  )

// ChildBounties
const childBountyCache = createTimedCache((unsafeApi) =>
  unsafeApi.query.ChildBounties.ChildBounties.getEntries(),
)
const childBountySource$ = (
  accountId: string,
): Observable<IdentifiedLock | null> =>
  unsafeClient$.pipe(
    switchMap(async ({ client }) => {
      const bounties = await childBountyCache(client)
      const ownBounties = bounties
        .map(({ value, keyArgs }): UnlockAction | null => {
          if (
            value.status.value &&
            "curator" in value.status.value &&
            value.status.value.curator === accountId
          ) {
            return {
              action: `ChildBounty ${keyArgs.join("-")}`,
              amount: value.curator_deposit,
              tx: null,
            }
          }
          return null
        })
        .filter((v) => v !== null)
      if (!ownBounties.length) return null

      return {
        id: "Bounties",
        amount: ownBounties.reduce((acc, v) => acc + v.amount, 0n),
        unlockable: ownBounties,
      }
    }),
  )

// Multisigs
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

// NFTs
const nftSource$ = (accountId: string): Observable<IdentifiedLock | null> =>
  unsafeClient$.pipe(
    switchMap(({ unsafeApi }) =>
      from(unsafeApi.query.Nfts.CollectionAccount.getEntries(accountId)).pipe(
        switchMap(async (result): Promise<IdentifiedLock | null> => {
          const collectionIds = result.map(({ keyArgs }): [number] => [
            keyArgs[1],
          ])
          if (!collectionIds.length) return null

          const collections =
            await unsafeApi.query.Nfts.Collection.getValues(collectionIds)
          const totalAmount = collections.reduce(
            (acc, c) => acc + (c?.owner_deposit ?? 0n),
            0n,
          )
          if (totalAmount == 0n) return null

          return {
            id: "Nfts",
            amount: totalAmount,
            unlockable: collections.map((c, i) => ({
              action: `Collection ${collectionIds[i]}`,
              amount: c?.owner_deposit ?? 0n,
              tx: null,
            })),
          }
        }),
      ),
    ),
  )

// Proxies
// To support pure proxies, we need a timepoint that it's not stored anywhere on-chain… So there's really no way around it without an indexer
const proxySource$ = (accountId: string): Observable<IdentifiedLock | null> =>
  unsafeClient$.pipe(
    switchMap(async ({ unsafeApi }) => {
      const [proxy, factor] = await Promise.all([
        unsafeApi.query.Proxy.Proxies.getValue(accountId),
        unsafeApi.constants.Proxy.ProxyDepositFactor(),
      ])
      const amount = proxy?.[1]
      if (!amount) return null

      const removeProxyActions = proxy[0].map(
        (p): UnlockAction => ({
          action: `Remove ${p.delegate}`,
          amount: proxy[0].length > 1 ? factor : amount,
          warn: "If you're calling this from a proxy, you could lose access to the account",
          tx: unsafeApi.tx.Proxy.remove_proxy({
            ...p,
            delegate: MultiAddress.Id(p.delegate),
          }),
        }),
      )
      const removeAllAction: UnlockAction = {
        action: `Remove all`,
        amount,
        warn: "If you're calling this from a proxy, you WILL lose access to the account",
        tx: unsafeApi.tx.Proxy.remove_proxies(),
      }

      return {
        id: "Proxy",
        amount,
        unlockable: [...removeProxyActions, removeAllAction],
      }
    }),
  )

// Referenda
const referendaCache = createTimedCache(async (unsafeApi) => {
  const entries = await unsafeApi.query.Referenda.ReferendumInfoFor.getEntries()

  return entries.map(({ keyArgs, value }) => {
    const [submission, decision] =
      value.type === "Killed"
        ? []
        : value.type === "Ongoing"
          ? [value.value.submission_deposit, value.value.decision_deposit]
          : [value.value[1], value.value[2]]
    return {
      id: keyArgs[0],
      type: value.type,
      submission,
      decision,
    }
  })
})
const referendaSource$ = (
  accountId: string,
): Observable<IdentifiedLock | null> =>
  unsafeClient$.pipe(
    switchMap(async ({ client, unsafeApi }): Promise<IdentifiedLock | null> => {
      const referenda = await referendaCache(client)
      const unlockable = referenda.flatMap((referenda): UnlockAction[] => {
        const result: UnlockAction[] = []
        if (referenda.submission?.who === accountId) {
          const canRefund = ["Approved", "Cancelled"].includes(referenda.type)
          result.push({
            action: `Refund submission deposit ${referenda.id}`,
            amount: referenda.submission.amount,
            tx: canRefund
              ? unsafeApi.tx.Referenda.refund_submission_deposit({
                  index: referenda.id,
                })
              : null,
            warn: canRefund
              ? undefined
              : "Can't refund: referendum status not Approved or Cancelled",
          })
        }
        if (referenda.decision?.who === accountId) {
          const canRefund = referenda.type !== "Ongoing"
          result.push({
            action: `Refund decision deposit ${referenda.id}`,
            amount: referenda.decision.amount,
            tx: canRefund
              ? unsafeApi.tx.Referenda.refund_decision_deposit({
                  index: referenda.id,
                })
              : null,
            warn: canRefund
              ? undefined
              : "Can't refund: referendum status is Ongoing",
          })
        }
        return result
      })
      if (!unlockable.length) return null

      return {
        id: "Referenda",
        amount: unlockable.map((v) => v.amount).reduce((a, b) => a + b),
        unlockable,
      }
    }),
  )

const reserveSources = [
  multisigSource$,
  referendaSource$,
  assetSource$,
  nftSource$,
  bountySource$,
  childBountySource$,
  proxySource$,
]

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
          note: "Could be Pure Proxies, Identity deposits, or other custom reserves",
          unlockable: [],
        })
      }
      return completedResults
    }),
  )
