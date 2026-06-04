import { Link } from "@/hashParams"
import { TDryRunChainResult, TDryRunResult } from "@paraspell/sdk"
import { Button } from "@polkahub/ui-components"
import { state, useStateObservable, withDefault } from "@react-rxjs/core"
import { createSignal } from "@react-rxjs/utils"
import { jsonSerialize, toHex } from "polkadot-api/utils"
import { useSelectedAccount } from "polkahub"
import { FC } from "react"
import {
  combineLatest,
  filter,
  from,
  map,
  startWith,
  switchMap,
  withLatestFrom,
} from "rxjs"
import { trackTx } from "../Extrinsics/ExtrinsicsWorkspaceEntry"
import { routeInfo$ } from "./RoutePreview"
import { paraspellBuilder$, setupConfig$ } from "./Setup"

export const Submit = () => {
  return (
    <div>
      <Validation />
      <DryRun />
      <Export />
    </div>
  )
}

const Validation = () => {
  const setupConfig = useStateObservable(setupConfig$)
  const routeInfo = useStateObservable(routeInfo$)

  const formatChecks = setupConfig ? !!routeInfo : null
  const balanceFeeChecks = routeInfo
    ? routeInfo.origin.xcmFee.sufficient &&
      (typeof routeInfo.destination.receivedCurrency.receivedAmount === "bigint"
        ? routeInfo.destination.receivedCurrency.receivedAmount > 0n
        : null)
    : null

  return (
    <div>
      <h3>Validation</h3>
      <div>
        <div>Format checks</div>
        <div>
          {formatChecks == null ? "-" : formatChecks ? "Passed" : "Failed"}
        </div>
      </div>
      <div>
        <div>Balances & fees</div>
        <div>
          {balanceFeeChecks == null
            ? "-"
            : balanceFeeChecks
              ? "Passed"
              : "Failed"}
        </div>
      </div>
    </div>
  )
}

const [dryRun$, dryRun] = createSignal()
const dryRunResult$ = state(
  dryRun$.pipe(
    withLatestFrom(paraspellBuilder$),
    map(([, b]) => b),
    filter((v) => v != null),
    switchMap((builder) =>
      from(builder.dryRun()).pipe(startWith("loading" as const)),
    ),
  ),
  null,
)
const DryRun = () => {
  const builder = useStateObservable(paraspellBuilder$)
  const dryRunResult = useStateObservable(dryRunResult$)

  return (
    <div>
      <div>
        <div>Dry run result</div>
        {dryRunResult === "loading" ? (
          <div>Loading…</div>
        ) : dryRunResult ? (
          <DryRunResult result={dryRunResult} />
        ) : null}
      </div>
      <Button type="button" onClick={dryRun} disabled={!builder}>
        Dry run
      </Button>
    </div>
  )
}
const DryRunResult: FC<{ result: TDryRunResult }> = ({ result }) => {
  const failedView = result.failureChain ? (
    <div>
      <div>Chain: {result.failureChain}</div>
      {result.failureReason ? <div>{result.failureReason}</div> : null}
      {result.failureSubReason ? <div>{result.failureSubReason}</div> : null}
    </div>
  ) : null

  return (
    <div>
      {failedView}
      <div>
        <div>Origin</div>
        <DryRunChainResult result={result.origin} />
      </div>
      {result.hops.map((hop, i) => (
        <div key={i}>
          <div>{hop.chain}</div>
          <DryRunChainResult result={hop.result} />
        </div>
      ))}
      {result.destination ? (
        <div>
          <div>Dest</div>
          <DryRunChainResult result={result.destination} />
        </div>
      ) : null}
    </div>
  )
}
const DryRunChainResult: FC<{ result: TDryRunChainResult }> = ({ result }) => {
  if (!result.success) {
    return (
      <div>
        <div>Failed</div>
        <div>{result.failureReason}</div>
        {result.failureSubReason ? <div>{result.failureSubReason}</div> : null}
      </div>
    )
  }
  return (
    <div>
      <div>Success</div>
      <div>Fee: {result.fee}</div>
      <div>Dest ParaId: {result.destParaId}</div>
      <div>
        ForwardedXcm: {JSON.stringify(result.forwardedXcms, jsonSerialize)}
      </div>
    </div>
  )
}

const resultTx$ = paraspellBuilder$.pipeState(
  switchMap((builder) => builder?.build() ?? [null]),
  switchMap((papiTx) =>
    papiTx
      ? combineLatest({
          tx: [papiTx],
          encodedData: papiTx.getEncodedData(),
        })
      : [null],
  ),
  withDefault(null),
)

const Export = () => {
  const resultTx = useStateObservable(resultTx$)
  const [account] = useSelectedAccount()

  const submit = async () => {
    if (!resultTx || !account?.signer) return
    const signed = await resultTx.tx.sign(account.signer)
    trackTx(signed, resultTx.tx.decodedCall, account)
  }

  return (
    <div>
      <Button
        type="button"
        disabled={!resultTx || !account?.signer}
        onClick={submit}
      >
        Sign and submit
      </Button>
      <Link
        to={`/extrinsics/#data=${resultTx ? toHex(resultTx.encodedData) : ""}`}
      >
        Open in extrinsics
      </Link>
    </div>
  )
}
