import { decodeRsprConsensus } from "@/pages/Explorer/Detail/digests/rspr"
import { client$ } from "@/state/chains/chain.state"
import { DotAh } from "@polkadot-api/descriptors"
import { liftSuspense, sinkSuspense } from "@react-rxjs/core"
import { PolkadotClient, Transaction, TypedApi } from "polkadot-api"
import { catchError, map, ObservableInput, pipe } from "rxjs"

export const getRelayBlock = async (client: PolkadotClient) => {
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

export const batch = (
  api: TypedApi<DotAh, boolean>,
  txs: Transaction[],
): Transaction | undefined =>
  txs.length > 1
    ? api.tx.Utility.batch({
        calls: txs.map((tx) => tx.decodedCall),
      })
    : txs[0]

export interface UnlockAction {
  amount: bigint
  warn?: string
  action: string
  tx: Transaction | null
}
export interface IdentifiedLock {
  id: string
  note?: string
  amount: bigint
  unlockable: UnlockAction[]
}

export const unsafeClient$ = client$.pipeState(
  map((client) => ({
    client,
    unsafeApi: client.getUnsafeApi<DotAh>(),
  })),
)

export const fallbackWhenError = <T, A extends T>(
  fallback: ObservableInput<A>,
) =>
  pipe(
    liftSuspense<T>(),
    catchError((ex) => {
      console.log(ex)
      return fallback
    }),
    sinkSuspense(),
  )
