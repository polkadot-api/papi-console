import { createState } from "@/lib/externalState"
import { unsafeApi$ } from "@/state/chains/chain.state"
import { liftSuspense, state, SUSPENSE } from "@react-rxjs/core"
import {
  createSignal,
  mergeWithKey,
  switchMapSuspended,
} from "@react-rxjs/utils"
import { TxOptions } from "polkadot-api"
import { combineLatest, distinctUntilChanged, map, scan } from "rxjs"
import { callData$ } from "../componentValue.state"
import { customSignedExtensions$ } from "../CustomSignedExt"

export const [nonceChanged$, setNonce] = createSignal<string>()
export const [nonceBlurred$, blurNonce] = createSignal()

const isIntegerStr = (str: string) => /^\d+$/.test(str)
export const nonce$ = state(
  mergeWithKey({
    nonceChanged$,
    nonceBlurred$,
  }).pipe(
    scan(
      (acc, v) =>
        v.type === "nonceChanged$" ? v.payload : isIntegerStr(acc) ? acc : "",
      "",
    ),
  ),
  "",
)

type Mortality = NonNullable<TxOptions<any, any>["mortality"]>
export const DEFAULT_MORTAL = {
  mortal: true,
  period: 64,
}

export const [mortality$, setMortality] = createState<Mortality>(DEFAULT_MORTAL)
export const [tip$, setTip] = createState("0")

export const transaction$ = state(
  combineLatest([unsafeApi$, callData$]).pipe(
    switchMapSuspended(([unsafeApi, callData]) =>
      callData ? unsafeApi.txFromCallData(callData) : [null],
    ),
    liftSuspense(),
    map((v) => (v === SUSPENSE ? null : v)),
  ),
  null,
)

export const txOptions$ = state(
  combineLatest([
    nonce$.pipe(
      distinctUntilChanged(),
      map((v) => (isIntegerStr(v) ? Number(v) : null)),
    ),
    mortality$,
    tip$.pipe(map((v) => (isIntegerStr(v) ? BigInt(v) : null))),
    customSignedExtensions$,
  ]).pipe(
    map(([nonce, mortality, tip, signedExt]): TxOptions<any, any> => {
      return {
        mortality,
        nonce: nonce ?? undefined,
        tip: tip ?? undefined,
        customSignedExtensions: signedExt,
      }
    }),
  ),
  {} satisfies TxOptions<any, any>,
)
