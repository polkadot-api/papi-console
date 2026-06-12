/*
Frozen:
Locks: Vesting, OpenGov `::set_lock(` `Balances.locks`

Reserved:
Holds: Contracts, DelegatedStaking, Preimage `::hold(` `Balances.holds`
Reserves: Assets, Bounties, ChildBounties, Identity, Multisig, Nfts, Proxy, Referenda, Staking  `::reserve(`
*/

import { client$ } from "@/state/chains/chain.state"
import { shortStr } from "@/utils"
import { DotAh, MultiAddress } from "@polkadot-api/descriptors"
import { getExtrinsicDecoder } from "@polkadot-api/tx-utils"
import { Binary, HexString, Transaction, TypedApi } from "polkadot-api"
import { filter, firstValueFrom } from "rxjs"
import { decodeRsprConsensus } from "../Explorer/Detail/digests/rspr"
import { balance$ } from "./AccountList"

const IDS = {
  vesting: Binary.toHex(Binary.fromText("vesting ")),
  convictionVoting: Binary.toHex(Binary.fromText("pyconvot")),
}

const getRelayBlock = async () => {
  const client = await client$.getValue()
  const header = await client.getBlockHeader(
    (await client.getBestBlocks())[0].hash,
  )
  const RSPRDigest = header.digests.find(
    (digest) => digest.type === "consensus" && digest.value.engine === "RPSR",
  )
  if (RSPRDigest) {
    const decoded = decodeRsprConsensus((RSPRDigest.value as any).payload)
    if (decoded) return decoded.blockNumber
  }
  return null
}

const batch = (
  api: TypedApi<DotAh, boolean>,
  txs: Transaction[],
): Transaction | undefined =>
  txs.length > 1
    ? api.tx.Utility.batch({
        calls: txs.map((tx) => tx.decodedCall),
      })
    : txs[0]

interface IdentifiedLock {
  id: string
  amount: bigint
  unlockable: {
    amount: bigint
    warn?: string
    action: string
    tx: Transaction | null
  }[]
}
const getFreezes = async (accountId: string): Promise<IdentifiedLock[]> => {
  const [client, relayBlock] = await Promise.all([
    client$.getValue(),
    getRelayBlock(),
  ])
  const unsafeApi = client.getUnsafeApi<DotAh>()

  const locks = await unsafeApi.query.Balances.Locks.getValue(accountId)
  const mappedLocks = await Promise.all(
    locks.map(async (lock) => {
      try {
        if (lock.id === IDS.vesting && relayBlock != null) {
          const vested =
            await unsafeApi.query.Vesting.Vesting.getValue(accountId)
          const vestLocked =
            vested
              ?.map((vest) => {
                const blockCount = relayBlock - vest.starting_block
                const unlockedAmount = BigInt(blockCount) * vest.per_block
                const lockedAmount = vest.locked - unlockedAmount
                return lockedAmount > 0 ? lockedAmount : 0n
              })
              .reduce((a, b) => a + b, 0n) ?? 0n

          return {
            id: "Vesting",
            amount: lock.amount,
            unlockable: [
              {
                amount: lock.amount - vestLocked,
                action: "Vest",
                tx: unsafeApi.tx.Vesting.vest(),
              },
            ],
          }
        }
        if (lock.id === IDS.convictionVoting) {
          const [votingFor] = await Promise.all([
            unsafeApi.query.ConvictionVoting.VotingFor.getEntries(accountId),
            // TODO add actions for removing vote and unlocking
            // unsafeApi.constants.ConvictionVoting.VoteLockingPeriod(),
          ])

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

          return {
            id: "OpenGov",
            amount: lock.amount,
            unlockable: unlockAction
              ? [
                  {
                    action: "Unlock",
                    amount: unlockAmount,
                    tx: unlockAction,
                  },
                ]
              : [],
          }
        }
      } catch (ex) {
        console.error(ex)
      }

      return {
        id: lock.id,
        amount: lock.amount,
        unlockable: [],
      }
    }),
  )
  return mappedLocks
}
const getHodls = async (accountId: string): Promise<IdentifiedLock[]> => {
  const client = await client$.getValue()
  const unsafeApi = client.getUnsafeApi<DotAh>()

  const hodls = await unsafeApi.query.Balances.Holds.getValue(accountId)
  const mappedHodls = await Promise.all(
    hodls.map(async (hodl) => {
      try {
        switch (hodl.id.type) {
          case "Preimage": {
            const [statusFor, requestStatusFor] = await Promise.all([
              unsafeApi.query.Preimage.StatusFor.getEntries(),
              unsafeApi.query.Preimage.RequestStatusFor.getEntries(),
            ])
            const preimages = [
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
            const ownPreimages = preimages.filter(
              ({ depositor }) => depositor === accountId,
            )
            console.log("preimages", preimages)
            console.log("own", ownPreimages)
            const totalUnlockable = ownPreimages
              .map(({ deposit }) => deposit ?? 0n)
              .reduce((acc, v) => acc + v, 0n)

            const individualActions = ownPreimages.map(
              ({ hash, deposit, len }) => ({
                action: `Unnote ${shortStr(hash, 6)} len=${len ?? "N/A"}`,
                warn: "If this preimage is being used in a referendum or something else, removing the preimage will cause it to fail",
                amount: deposit ?? 0n,
                tx: unsafeApi.tx.Preimage.unnote_preimage({
                  hash,
                }),
              }),
            )
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
                  action: "Unnote all",
                  warn: "If any preimage is being used in a referendum or something else, removing the preimage will cause it to fail",
                  amount: totalUnlockable,
                  tx: unoteAllTx,
                }
              : null
            const unlockable = [
              ...(individualActions.length > 1 ? individualActions : []),
              ...(unnoteAllAction ? [unnoteAllAction] : []),
            ]

            return {
              id: "Preimage",
              amount: hodl.amount,
              unlockable,
            }
          }
        }
      } catch (ex) {
        console.error(ex)
      }

      return {
        id: hodl.id.type,
        amount: hodl.amount,
        unlockable: [],
      }
    }),
  )
  return mappedHodls
}
const getReserveReserves = async (
  accountId: string,
  totalReserves: bigint,
): Promise<IdentifiedLock[]> => {
  const client = await client$.getValue()
  const unsafeApi = client.getUnsafeApi<DotAh>()
  const result: IdentifiedLock[] = []

  const multisigs = await unsafeApi.query.Multisig.Multisigs.getEntries()
  const ownMultisigs = multisigs.filter(
    ({ value }) => value.depositor === accountId,
  )
  const getMultisigUnlockable = async (
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

  if (ownMultisigs.length) {
    const totalAmount = ownMultisigs
      .map((v) => v.value.deposit)
      .reduce((acc, v) => acc + v)
    const unlockable = await Promise.all(
      ownMultisigs.map(({ keyArgs, value }) =>
        getMultisigUnlockable(value.deposit, keyArgs[1], value.when),
      ),
    )
    result.push({
      id: "Multisig",
      amount: totalAmount,
      unlockable,
    })
  }

  const totalIdentified = result.reduce((acc, v) => acc + v.amount, 0n)
  if (totalIdentified < totalReserves) {
    result.push({
      id: "Unknown reserved",
      amount: totalReserves - totalIdentified,
      unlockable: [],
    })
  }

  return result
}

const getReserves = async (accountId: string, reserved: bigint) => {
  const hodls = await getHodls(accountId)
  const totalReserves = reserved - hodls.reduce((acc, v) => acc + v.amount, 0n)
  const reserves = totalReserves
    ? await getReserveReserves(accountId, totalReserves)
    : []

  return [...hodls, ...reserves]
}

const accountLocks = async (accountId: string) => {
  const balance = await firstValueFrom(
    balance$(accountId).pipe(filter((v) => v !== null)),
  )

  const [freezes, reserves] = await Promise.all([
    balance.frozen ? getFreezes(accountId) : [],
    balance.reserved ? getReserves(accountId, balance.reserved) : [],
  ])

  console.log(freezes, reserves)
}

accountLocks("14u9dEGTLgwwzQ6oMm6bN2mt7xxwEko8qciKw9jg3Uc4pYjA")
