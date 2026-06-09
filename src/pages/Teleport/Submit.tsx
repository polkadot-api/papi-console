import { Link } from "@/hashParams"
import {
  TDryRunChainResult,
  TDryRunResult,
  TPapiTransaction,
} from "@paraspell/sdk"
import { formatToken } from "@polkadot-api/react-components"
import { Button } from "@polkahub/ui-components"
import { state, useStateObservable, withDefault } from "@react-rxjs/core"
import { createSignal } from "@react-rxjs/utils"
import {
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  Loader2,
  LockKeyhole,
  Play,
  TriangleAlert,
  XCircle,
} from "lucide-react"
import { PolkadotClient } from "polkadot-api"
import { jsonSerialize, toHex } from "polkadot-api/utils"
import { useSelectedAccount } from "polkahub"
import { FC, ReactNode } from "react"
import {
  catchError,
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
    <section className="min-w-0 rounded-lg border border-border bg-card text-card-foreground shadow-sm">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">Validation & submit</h2>
      </div>
      <div className="space-y-4 p-4">
        <Validation />
        <DryRun />
        <Export />
      </div>
    </section>
  )
}

const Validation = () => {
  const setupConfig = useStateObservable(setupConfig$)
  const routeInfo = useStateObservable(routeInfo$)

  const formatChecks = setupConfig ? !!routeInfo : null
  const balanceFeeChecks =
    routeInfo && routeInfo !== "loading"
      ? routeInfo.origin.xcmFee.sufficient &&
        (typeof routeInfo.destination.receivedCurrency.receivedAmount ===
        "bigint"
          ? routeInfo.destination.receivedCurrency.receivedAmount > 0n
          : null)
      : null

  return (
    <section className="space-y-3 rounded-md border border-border bg-background/60 p-3">
      <SectionTitle>Validation</SectionTitle>
      <div className="space-y-2">
        <ValidationRow label="Format checks" value={formatChecks} />
        <ValidationRow label="Balances & fees" value={balanceFeeChecks} />
      </div>
    </section>
  )
}

const [dryRun$, dryRun] = createSignal()
const dryRunResult$ = state(
  dryRun$.pipe(
    withLatestFrom(paraspellBuilder$),
    map(([, b]) => b),
    filter((v) => v != null),
    switchMap((builder) =>
      from(builder.dryRun()).pipe(
        map((value) => ({ type: "success" as const, value })),
        startWith({ type: "loading" as const }),
        catchError((ex: any) => [
          { type: "error" as const, value: ex.message },
        ]),
      ),
    ),
  ),
  null,
)
const DryRun = () => {
  const builder = useStateObservable(paraspellBuilder$)
  const dryRunResult = useStateObservable(dryRunResult$)

  return (
    <section className="space-y-3 rounded-md border border-border bg-background/60 p-3">
      <div className="flex items-center justify-between gap-3">
        <SectionTitle>Dry run</SectionTitle>
        <Button
          type="button"
          onClick={() => dryRun()}
          disabled={!builder || dryRunResult?.type === "loading"}
          className="inline-flex h-8 items-center gap-2 rounded-md px-3 text-xs"
        >
          {dryRunResult?.type === "loading" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
          Dry run
        </Button>
      </div>
      <div>
        {!dryRunResult ? (
          <div className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
            Not run
          </div>
        ) : dryRunResult.type === "loading" ? (
          <div className="flex items-center gap-2 rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Running simulation
          </div>
        ) : dryRunResult.type === "success" ? (
          <DryRunResult result={dryRunResult.value} />
        ) : (
          <DryRunError message={dryRunResult.value} />
        )}
      </div>
    </section>
  )
}

const DryRunError: FC<{ message: string }> = ({ message }) => (
  <div
    className="rounded-md border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-700 dark:text-red-300"
    role="alert"
  >
    <div className="flex items-start gap-2">
      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 space-y-1">
        <div className="font-medium">Dry run failed</div>
        <code className="block whitespace-pre-wrap wrap-break-word rounded-md border border-red-500/20 bg-background/70 px-2 py-1.5 text-xs text-red-800 dark:text-red-200">
          {message || "Unknown error"}
        </code>
      </div>
    </div>
  </div>
)

const DryRunResult: FC<{ result: TDryRunResult }> = ({ result }) => (
  <div className="space-y-3">
    <DryRunSection title="Origin">
      <DryRunChainResult result={result.origin} />
    </DryRunSection>
    {result.hops.map((hop, i) => (
      <DryRunSection title={hop.chain} key={i}>
        <DryRunChainResult result={hop.result} />
      </DryRunSection>
    ))}
    {result.destination ? (
      <DryRunSection title="Destination">
        <DryRunChainResult result={result.destination} />
      </DryRunSection>
    ) : null}
  </div>
)
const DryRunChainResult: FC<{ result: TDryRunChainResult }> = ({ result }) => {
  if (!result.success) {
    return (
      <div className="space-y-2 text-sm">
        <StatusBadge value={false} />
        <div className="text-red-700 dark:text-red-300">
          {result.failureReason}
        </div>
        {result.failureSubReason ? <div>{result.failureSubReason}</div> : null}
      </div>
    )
  }
  return (
    <div className="space-y-2 text-sm">
      <StatusBadge value />
      <DetailRow label="Fee" value={formatToken(result.fee, result.asset)} />
      {result.destParaId != null ? (
        <DetailRow label="Dest ParaId" value={result.destParaId} />
      ) : null}
      {result.forwardedXcms &&
      (!Array.isArray(result.forwardedXcms) ||
        result.forwardedXcms.length > 0) ? (
        <div className="space-y-1">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Forwarded XCM
          </div>
          <code className="block max-h-32 overflow-auto rounded-md border border-border bg-foreground/5 p-2 text-xs whitespace-pre-wrap break-all">
            {JSON.stringify(result.forwardedXcms, jsonSerialize, 2)}
          </code>
        </div>
      ) : null}
    </div>
  )
}

const resultingTransactions$ = paraspellBuilder$.pipeState(
  switchMap(
    (builder) =>
      builder?.buildAll().catch((ex) => {
        console.error(ex)
        return null
      }) ?? [null],
  ),
  switchMap(async (transactions) => {
    if (!transactions) return null

    const encodedDatas = await Promise.all(
      transactions.map(({ tx }) => tx.getEncodedData()),
    )

    return transactions.map(({ tx, api, chain }, i) => ({
      tx,
      api,
      chain,
      encodedData: encodedDatas[i],
    }))
  }),
  withDefault(null),
)

const Export = () => {
  const resultTransactions = useStateObservable(resultingTransactions$)

  return (
    <div className="space-y-3">
      <DevelopmentDisclaimer />
      {resultTransactions ? (
        resultTransactions.map((result, i) => (
          <ExportTx
            key={i}
            encodedData={result.encodedData}
            tx={result.tx}
            api={result.api === resultTransactions[0].api ? null : result.api}
            number={resultTransactions.length > 1 ? i + 1 : null}
          />
        ))
      ) : (
        <Button
          type="button"
          disabled
          className="flex h-10 w-full items-center justify-center gap-2 rounded-md text-sm font-semibold"
        >
          <LockKeyhole className="h-4 w-4" />
          Sign and submit
        </Button>
      )}
    </div>
  )
}

const DevelopmentDisclaimer = () => (
  <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
    <div className="min-w-0">
      <div className="font-medium">This feature is under development</div>
      <div className="mt-0.5 text-amber-800/80 dark:text-amber-200/80">
        Verify the generated call data before signing.
      </div>
    </div>
  </div>
)

const ExportTx: FC<{
  tx: TPapiTransaction
  encodedData: Uint8Array
  api?: PolkadotClient | null
  number?: number | null
}> = ({ tx, encodedData, api, number }) => {
  const [account] = useSelectedAccount()

  const submit = async () => {
    if (!account?.signer) return
    const signed = await tx.sign(account.signer)
    trackTx(signed, tx.decodedCall, account)
  }

  return (
    <div className="space-y-3">
      {number != null ? <div>#{number}</div> : null}
      <Button
        type="button"
        disabled={!account?.signer}
        onClick={submit}
        className="flex h-10 w-full items-center justify-center gap-2 rounded-md text-sm font-semibold"
      >
        <LockKeyhole className="h-4 w-4" />
        Sign and submit
      </Button>
      {api ? null : (
        <Link
          to={`/extrinsics/#data=${toHex(encodedData)}`}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-border bg-background text-sm font-medium text-foreground hover:bg-foreground/5"
        >
          <ExternalLink className="h-4 w-4" />
          Open in extrinsics
        </Link>
      )}
    </div>
  )
}

const SectionTitle: FC<{ children: ReactNode }> = ({ children }) => (
  <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
    {children}
  </h3>
)

const ValidationRow: FC<{ label: string; value: boolean | null }> = ({
  label,
  value,
}) => (
  <div className="flex items-center justify-between gap-3 text-sm">
    <span className="text-muted-foreground">{label}</span>
    <StatusBadge value={value} />
  </div>
)

const StatusBadge: FC<{ value: boolean | null }> = ({ value }) => {
  if (value == null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground">
        <CircleAlert className="h-3 w-3" />
        Not run
      </span>
    )
  }

  return value ? (
    <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
      <CheckCircle2 className="h-3 w-3" />
      Passed
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-300">
      <XCircle className="h-3 w-3" />
      Failed
    </span>
  )
}

const DryRunSection: FC<{
  title: string
  children: ReactNode
}> = ({ title, children }) => (
  <section className="space-y-2 rounded-md border border-border/70 bg-background/70 p-3">
    <h4 className="text-sm font-medium">{title}</h4>
    {children}
  </section>
)

const DetailRow: FC<{
  label: string
  value: ReactNode
}> = ({ label, value }) => (
  <div className="flex items-center justify-between gap-3">
    <span className="text-muted-foreground">{label}</span>
    <span className="min-w-0 wrap-break-word text-right font-mono">
      {value}
    </span>
  </div>
)
