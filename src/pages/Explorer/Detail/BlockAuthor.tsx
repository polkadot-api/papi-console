import { client$ } from "@/state/chains/chain.state"
import { Polkadot_people } from "@polkadot-api/descriptors"
import {
  _void,
  Bytes,
  HexString,
  Struct,
  u32,
  u64,
  Variant,
} from "@polkadot-api/substrate-bindings"
import { state, useStateObservable } from "@react-rxjs/core"
import { BlockHeader, PolkadotClient } from "polkadot-api"
import { AddressIdentity } from "polkahub"
import { FC, useEffect } from "react"
import {
  catchError,
  combineLatest,
  from,
  map,
  Observable,
  switchMap,
  take,
} from "rxjs"
import { blockInfo$, BlockState, finalized$ } from "../block.state"

const validatorCache: WeakMap<
  PolkadotClient,
  Record<number, string[]>
> = new WeakMap()

const fetchValidators = (
  client: PolkadotClient,
  at: HexString,
): Promise<string[]> =>
  client.getUnsafeApi<Polkadot_people>().query.Session.Validators.getValue({
    at,
  })
const fetchCachedValidators$ = (client: PolkadotClient, at: HexString) => {
  const api = client.getUnsafeApi<Polkadot_people>()
  return from(api.query.Session.CurrentIndex.getValue()).pipe(
    switchMap(async (idx) => {
      const cache = validatorCache.get(client) ?? {}
      validatorCache.set(client, cache)

      const cached = cache[idx]
      if (cached) return { idx, validators: cached }
      const validators = await fetchValidators(client, at)
      return { idx, validators }
    }),
  )
}
const validators$ = state(
  (block: HexString) =>
    client$.pipe(
      switchMap((client) =>
        combineLatest([
          fetchCachedValidators$(client, block),
          blockInfo$(block).pipe(map((v) => v.status)),
        ]).pipe(
          map(([{ idx, validators }, blockStatus]) => {
            if (
              blockStatus === BlockState.Finalized ||
              blockStatus === BlockState.Unknown
            ) {
              const cache = validatorCache.get(client) ?? {}
              validatorCache.set(client, cache)
              cache[idx] = validators
            }
            return validators
          }),
          withHodl(() => client.hodlBlock(block)),
          take(1),
          catchError(() => [null]),
        ),
      ),
    ),
  null,
)

// Subscribe to the validators of the finalized block so that best blocks author's of the same session will load faster
const finalizedValidators$ = finalized$.pipe(
  switchMap((block) => validators$(block.hash)),
)

export const BlockAuthor: FC<{ hash: HexString; header: BlockHeader }> = ({
  hash,
  header,
}) => {
  const validators = useStateObservable(validators$(hash))
  const idx = getAuthorityIdx(header)

  useEffect(() => {
    const sub = finalizedValidators$.subscribe()
    return () => sub.unsubscribe()
  }, [])

  if (idx == null || validators == null) return <div className="h-10" />

  return (
    <AddressIdentity
      addr={validators[Number(idx % BigInt(validators.length))]}
    />
  )
}

const DigestWithVRF = Struct({
  authority_index: u32,
  slot: u64,
  vrf_signature: Struct({
    pre_output: Bytes(32),
    proof: Bytes(64),
  }),
})
const BabePreDigest = Variant({
  Uknown: _void,
  Primary: DigestWithVRF,
  SecondaryPlain: Struct({
    authority_index: u32,
    slot: u64,
  }),
  SecondaryVRF: DigestWithVRF,
})

const getAuthorityIdx = (header: BlockHeader) => {
  const preRuntime = header.digests.find((d) => d.type === "preRuntime")?.value

  switch (preRuntime?.engine) {
    case "BABE": {
      const babe = BabePreDigest.dec(preRuntime.payload)
      if (!babe.value) return null
      return BigInt(babe.value.authority_index)
    }
    case "aura": {
      return u64.dec(preRuntime.payload)
    }
  }

  return null
}

const withHodl =
  <T,>(hodl: () => () => void) =>
  (source$: Observable<T>) =>
    new Observable<T>((obs) => {
      obs.add(source$.subscribe(obs))
      try {
        const hodled = hodl()
        obs.add(hodled)
      } catch (_) {
        // Nothing, it might happen if the block is not pinned
      }
      return obs
    })
