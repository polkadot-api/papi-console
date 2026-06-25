import { chainClient$ } from "@/state/chains/chain.state"
import { selectedAccount$ } from "@/state/polkahub"
import {
  DotAh,
  TransactionValidityTransactionSource,
} from "@polkadot-api/descriptors"
import { forklift, fromWorker } from "@polkadot-api/forklift"
import Worker from "@polkadot-api/forklift/worker?worker"
import { ChainHead$ } from "@polkadot-api/observable-client"
import { shareLatest } from "@react-rxjs/core"
import {
  AccountId,
  Binary,
  createClient,
  Enum,
  HexString,
  InvalidTxError,
  PolkadotClient,
  Transaction,
} from "polkadot-api"
import { getPolkadotSigner } from "polkadot-api/signer"
import { AccountAddress } from "polkahub"
import {
  catchError,
  combineLatest,
  filter,
  firstValueFrom,
  lastValueFrom,
  map,
  Observable,
  of,
  switchMap,
  take,
  TeardownLogic,
  toArray,
} from "rxjs"

const forkliftWorker = new Worker()

const promiseWithTeardown = <T>(
  deferFn: () => Promise<{
    value: T
    teardown: TeardownLogic
  }>,
) =>
  new Observable<T>((obs) => {
    deferFn().then(({ value, teardown }) => {
      obs.add(teardown)
      obs.next(value)
    })
  })

const forkLift$ = chainClient$.pipe(
  switchMap(({ client, chainHead }) =>
    promiseWithTeardown(async () => {
      console.log("Create forklift")
      const forklift = await createTmpForklift(client, chainHead)
      const forkClient = createClient(
        // withLogsRecorder(console.log, forklift.serve),
        forklift.serve,
      )
      return {
        value: { forklift, forkClient },
        teardown: () => {
          console.log("destroy forklift")
          forkClient.destroy()
          forklift.destroy()
        },
      }
    }),
  ),
  shareLatest(),
)

const fakeSign$ = (tx: Transaction, txOptions: any) =>
  combineLatest({
    signer: selectedAccount$.pipe(
      map((account) => (account ? createFakeSigner(account.address) : null)),
    ),
    mockChain: forkLift$.pipe(
      switchMap(async ({ forkClient }) => {
        const unsafeApi = forkClient.getUnsafeApi<DotAh>()
        return {
          client: forkClient,
          unsafeApi,
          tx: await unsafeApi.txFromCallData(await tx.getEncodedData()),
        }
      }),
    ),
  }).pipe(
    switchMap(async ({ signer, mockChain: { tx, unsafeApi, client } }) => {
      if (!signer) return null

      const extrinsic = await tx.sign(signer, txOptions)

      return { extrinsic, tx, unsafeApi, client }
    }),
  )

export const validate$ = (tx: Transaction, txOptions: any) =>
  fakeSign$(tx, txOptions).pipe(
    switchMap(async (evt) =>
      evt
        ? evt.unsafeApi.apis.TaggedTransactionQueue.validate_transaction(
            TransactionValidityTransactionSource.External(),
            evt.extrinsic.slice(2),
            (await evt.client.getFinalizedBlock()).hash,
          )
        : null,
    ),
    map((evt) =>
      !evt
        ? {
            type: "no-signer" as const,
            value: undefined,
          }
        : evt.success
          ? {
              type: "valid" as const,
              value: undefined,
            }
          : {
              type: "invalid" as const,
              value: evt.value.value.type,
            },
    ),
    catchError((ex) => {
      console.error(ex)
      return [
        {
          type: "error" as const,
          value: ex.error,
        },
      ]
    }),
    take(1),
  )

export const dryRun$ = (tx: Transaction, txOptions: any) =>
  fakeSign$(tx, txOptions).pipe(
    switchMap((evt) =>
      evt ? evt.client.submitAndWatch(evt.extrinsic) : [null],
    ),
    map((evt) => {
      if (!evt) {
        return {
          type: "no-signer" as const,
          value: undefined,
        }
      }
      if (evt.type === "txBestBlocksState" && evt.found) {
        return {
          type: "valid" as const,
          value: {
            ok: evt.ok,
            dispatchError: evt.dispatchError,
            events: evt.events,
          },
        }
      }
      return null
    }),
    catchError((ex) => {
      if (ex instanceof InvalidTxError) {
        return [
          {
            type: "invalid" as const,
            value: ex.error,
          },
        ]
      }
      console.error(ex)
      return []
    }),
    filter((v) => v !== null),
    take(1),
  )

const codeCache = new WeakMap<Uint8Array, Promise<Uint8Array>>()
const CODE_KEY = "0x3a636f6465"
const PARAMETERS_KEY =
  "0xc63bdd4a39095ccf55623a6f2872bf8ac63bdd4a39095ccf55623a6f2872bf8a"

const createTmpForklift = async (
  client: PolkadotClient,
  chainHead: ChainHead$,
) => {
  const [block] = await client.getBestBlocks()
  const unhodl = client.hodlBlock(block.hash)
  const metadata = await client.getMetadata(block.hash)

  // forklift needs the code, which is a big-ass query (~4MB).
  // PAPI doesn't have it, but we should prevent this query to be repeated by every block when the runtime is the same
  if (!codeCache.has(metadata)) {
    console.log("cache miss")
    const codeP = firstValueFrom(
      chainHead
        .storage$(block.hash, "value", () => CODE_KEY)
        .pipe(
          map((v) => {
            if (!v.value) {
              throw new Error("Code not available")
            }
            return Binary.fromHex(v.value)
          }),
        ),
    )
    codeCache.set(metadata, codeP)
  }

  // We can also optimise by pre-quering "Parameters.Parameters", which is often serialised and is mostly empty
  const parametersP = firstValueFrom(
    chainHead
      .storage$(block.hash, "descendantsValues", () => PARAMETERS_KEY)
      .pipe(
        map((v) =>
          Object.fromEntries(
            v.value.map(({ key, value }) => [key, Binary.fromHex(value)]),
          ),
        ),
      ),
  )
  const [code, parameters] = await Promise.all([
    codeCache.get(metadata)!,
    parametersP,
  ])

  const getBlock = async () => ({
    blockHash: block.hash,
    header: await client.getBlockHeader(block.hash),
    body: await client.getBlockBody(block.hash),
  })
  const getStorage = async (key: HexString) => {
    if (key === CODE_KEY) return code
    if (key.startsWith(PARAMETERS_KEY)) return parameters[key] ?? null

    console.log("gs", key)
    return firstValueFrom(
      chainHead
        .storage$(block.hash, "value", () => key)
        .pipe(map((v) => (v.value ? Binary.fromHex(v.value) : null))),
    )
  }
  const getStorageBatch = async (keys: HexString[]) => {
    if (!keys.length) return []

    console.log("gsb", keys)
    const result = new Array(keys.length)
    const keyToIdx = Object.fromEntries(keys.map((key, i) => [key, i]))

    const results = await lastValueFrom(
      chainHead
        .storageQueries$(
          block.hash,
          keys.map((key) => ({
            type: "value",
            key,
          })),
        )
        .pipe(toArray()),
    )
    results.forEach(
      (r) =>
        (result[keyToIdx[r.key]] = r.value ? Binary.fromHex(r.value) : null),
    )

    return result
  }
  const getStorageDescendants = (prefix: HexString) => {
    console.log("gsd", prefix)
    return firstValueFrom(
      chainHead
        .storage$(block.hash, "descendantsValues", () => prefix)
        .pipe(
          map((v) =>
            Object.fromEntries(
              v.value.map(({ key, value }) => [key, Binary.fromHex(value)]),
            ),
          ),
        ),
    )
  }
  const getChainSpecData = client.getChainSpecData

  return forklift(
    {
      block: getBlock(),
      getStorage,
      getStorageBatch,
      getStorageDescendants,
      getChainSpecData,
      destroy() {
        unhodl()
      },
    },
    {
      mockSignatureHost: true,
      disableOnIdle: true,
      buildBlockMode: Enum("timer", 0),
      executor: fromWorker(forkliftWorker),
    },
  )
}

const decodeAddress = (address: AccountAddress) =>
  address.startsWith("0x") ? Binary.fromHex(address) : AccountId().enc(address)!

export const createFakeSigner = (address: AccountAddress) =>
  getPolkadotSigner(decodeAddress(address), "Sr25519", () => {
    // From https://wiki.acala.network/build/sdks/homa
    const signature = new Uint8Array(64)
    signature.fill(0xcd)
    signature.set([0xde, 0xad, 0xbe, 0xef])
    return signature
  })
