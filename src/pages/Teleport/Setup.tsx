import { SearchableSelect } from "@/components/Select"
import { createState } from "@/lib/externalState"
import { client$ } from "@/state/chains/chain.state"
import { selectedAccount$ } from "@/state/polkahub"
import {
  Builder,
  CHAINS,
  getAssets,
  getBalance,
  getSupportedDestinations,
  TAssetInfo,
  TChain,
} from "@paraspell/sdk"
import { Input } from "@polkahub/ui-components"
import { state, useStateObservable } from "@react-rxjs/core"
import { createSignal } from "@react-rxjs/utils"
import { Banknote, Coins, MapPin, Send, UserRound, Wallet } from "lucide-react"
import { jsonSerialize } from "polkadot-api/utils"
import { AddressInput } from "polkahub"
import { FC, PropsWithChildren, ReactNode } from "react"
import {
  combineLatest,
  map,
  merge,
  startWith,
  switchMap,
  withLatestFrom,
} from "rxjs"
import { SelectAccount } from "../Extrinsics/SubmitTx/SubmitTxForm"
import { chainNameToParaspell } from "./chainNameToParaspell"

export const origin$ = client$.pipeState(
  switchMap((client) => client._request("system_chain", [])),
  map(
    (name) =>
      chainNameToParaspell[name] ??
      (CHAINS.includes(name) ? (name as TChain) : null),
  ),
)

export const Setup = () => {
  return (
    <section className="min-w-0 rounded-lg border border-border bg-card text-card-foreground shadow-sm">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">Transfer setup</h2>
      </div>

      <div className="space-y-3 p-4">
        <SetupCard title="Origin chain" icon={<MapPin className="h-4 w-4" />}>
          <OriginChain />
        </SetupCard>
        <SetupCard title="Sender" icon={<Wallet className="h-4 w-4" />}>
          <SelectAccount />
        </SetupCard>
        <SetupCard title="Asset" icon={<Coins className="h-4 w-4" />}>
          <AssetPicker />
        </SetupCard>
        <SetupCard
          title="Destination chain"
          icon={<Send className="h-4 w-4" />}
        >
          <DestPicker />
        </SetupCard>
        <SetupCard title="Amount" icon={<Banknote className="h-4 w-4" />}>
          <AmountPicker />
        </SetupCard>
        <SetupCard title="Recipient" icon={<UserRound className="h-4 w-4" />}>
          <RecipientPicker />
        </SetupCard>
        {/* <SetupCard title="Advanced"></SetupCard> */}
      </div>
    </section>
  )
}

const OriginChain = () => {
  const origin = useStateObservable(origin$)

  return (
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{origin}</div>
        <div className="text-xs text-muted-foreground">Connected origin</div>
      </div>
      <StatusPill>Connected</StatusPill>
    </div>
  )
}

const assetKey = (info: TAssetInfo) =>
  JSON.stringify(info.location, jsonSerialize)
const assetList$ = origin$.pipeState(
  map((origin) => (origin ? getAssets(origin) : [])),
  map((list) =>
    Object.fromEntries(list.map((asset) => [assetKey(asset), asset])),
  ),
)
const [changeAsset$, changeAsset] = createSignal<TAssetInfo>()
const selectedAsset$ = state(
  combineLatest([assetList$, changeAsset$.pipe(startWith(null))]).pipe(
    map(([list, asset]) => (asset ? (list[assetKey(asset)] ?? null) : null)),
  ),
)
const balance$ = selectedAsset$.pipeState(
  switchMap((asset) =>
    combineLatest([selectedAccount$, origin$, client$]).pipe(
      switchMap(([selectedAccount, origin, client]) => {
        if (!asset || !selectedAccount) return [null]
        return getBalance({
          address: selectedAccount.address,
          chain: origin,
          api: client,
          currency: {
            location: asset.location,
          },
        })
      }),
    ),
  ),
)
const AssetPicker = () => {
  const assets = useStateObservable(assetList$)
  const selectedAsset = useStateObservable(selectedAsset$)
  const balance = useStateObservable(balance$)
  const selectedAssetKey = selectedAsset ? assetKey(selectedAsset) : null
  // TODO explore custom assets
  return (
    <div className="space-y-2">
      <SearchableSelect
        value={selectedAssetKey}
        setValue={(v) => {
          if (v && assets[v]) changeAsset(assets[v])
        }}
        options={Object.entries(assets).map(([key, asset]) => ({
          value: key,
          text: asset.assetId
            ? `${asset.symbol} (${formatValue(asset.assetId)})`
            : asset.symbol,
        }))}
        className="h-10 w-full bg-background"
        contentClassName="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)]"
      />
      <KeyValue label="Balance" value={formatValue(balance)} />
    </div>
  )
}

const supportedDestinations$ = state(
  combineLatest([origin$, selectedAsset$]).pipe(
    map(([origin, selectedAsset]) => {
      if (!origin || !selectedAsset) return []

      return getSupportedDestinations(origin, {
        location: selectedAsset.location,
      })
    }),
  ),
)
const [changeDest$, changeDest] = createSignal<TChain>()
const selectedDest$ = state(
  combineLatest([
    supportedDestinations$,
    changeDest$.pipe(startWith(null)),
  ]).pipe(map(([list, asset]) => (list?.includes(asset!) ? asset : null))),
)
const DestPicker = () => {
  const chains = useStateObservable(supportedDestinations$)
  const selectedDest = useStateObservable(selectedDest$)
  const selectedAsset = useStateObservable(selectedAsset$)

  // TODO explore custom chains
  return (
    <SearchableSelect
      value={selectedDest}
      setValue={(v) => {
        if (v) changeDest(v)
      }}
      options={chains.map((chain) => ({
        value: chain,
        text: chain,
      }))}
      disabled={!selectedAsset}
      className="h-10 w-full bg-background"
      contentClassName="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)]"
    />
  )
}

const [amountChange$, changeAmount] = createSignal<string>()
const amountStr$ = state(
  merge(
    merge(origin$, selectedAccount$, selectedAsset$).pipe(map(() => "0")),
    amountChange$,
  ),
  "0",
)
const amount$ = amountStr$.pipeState(
  map((v) => (v && !isNaN(Number(v)) ? Number(v) : null)),
)
const AmountPicker = () => {
  const amount = useStateObservable(amountStr$)
  const selectedAsset = useStateObservable(selectedAsset$)

  return (
    <div className="flex min-w-0 items-center rounded-md focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
      <Input
        type="number"
        value={amount}
        onChange={(evt) => changeAmount(evt.target.value)}
        className="min-w-0 flex-1 rounded-r-none border-r-0 bg-background font-mono focus-visible:ring-0"
        disabled={!selectedAsset}
      />
      <div className="flex h-10 min-w-16 items-center justify-center rounded-r-md border border-border bg-background px-3 text-xs font-medium text-muted-foreground">
        {selectedAsset?.symbol ?? "Asset"}
      </div>
    </div>
  )
}

const [recipient$, setRecipient] = createState<string | null>(null)
const RecipientPicker = () => {
  const recipient = useStateObservable(recipient$)

  return (
    <AddressInput
      className="max-w-full"
      triggerClassName="h-10 bg-background"
      value={recipient}
      onChange={setRecipient}
      disableClear
    />
  )
}

export const setupConfig$ = state(
  combineLatest([
    origin$,
    selectedAccount$,
    selectedAsset$,
    selectedDest$,
    amount$,
    recipient$,
  ]).pipe(
    map(([origin, account, asset, dest, amount, recipient]) => {
      if (
        !origin ||
        !account ||
        !asset ||
        !dest ||
        amount == null ||
        !recipient
      )
        return null

      return { origin, account, asset, dest, amount, recipient }
    }),
  ),
  null,
)
export const paraspellBuilder$ = setupConfig$.pipeState(
  withLatestFrom(client$),
  map(([v, client]) =>
    v
      ? Builder({
          abstractDecimals: false,
          apiOverrides: {
            [v.origin]: client,
          },
        })
          .from(v.origin)
          .to(v.dest)
          .currency({ location: v.asset.location, amount: v.amount })
          .recipient(v.recipient)
          .sender(v.account.address)
      : null,
  ),
)

const SetupCard: FC<
  PropsWithChildren<{
    title: string
    icon?: ReactNode
  }>
> = ({ title, icon, children }) => (
  <section className="rounded-md border border-border bg-background/60 p-3">
    <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {icon ? <span className="text-muted-foreground">{icon}</span> : null}
      <span>{title}</span>
    </div>
    {children}
  </section>
)

const StatusPill: FC<PropsWithChildren> = ({ children }) => (
  <span className="shrink-0 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
    {children}
  </span>
)

const KeyValue: FC<{ label: string; value: ReactNode }> = ({
  label,
  value,
}) => (
  <div className="flex items-center justify-between gap-3 text-xs">
    <span className="text-muted-foreground">{label}</span>
    <span className="min-w-0 truncate text-right font-mono">{value}</span>
  </div>
)

const formatValue = (value: unknown): ReactNode => {
  if (value == null || value === "") return "-"
  if (typeof value === "bigint" || typeof value === "number")
    return value.toLocaleString()
  if (typeof value === "string") return value
  return String(value)
}
