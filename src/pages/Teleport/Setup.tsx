import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { AddressInput, Input } from "@polkahub/ui-components"
import { state, useStateObservable } from "@react-rxjs/core"
import { createSignal } from "@react-rxjs/utils"
import { jsonSerialize } from "polkadot-api/utils"
import { FC, PropsWithChildren } from "react"
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
    <div>
      <SetupCard title="Origin">{origin$}</SetupCard>
      <SetupCard title="Sender">
        <SelectAccount />
      </SetupCard>
      <SetupCard title="Asset">
        <AssetPicker />
      </SetupCard>
      <SetupCard title="Dest">
        <DestPicker />
      </SetupCard>
      <SetupCard title="Amount">
        <AmountPicker />
      </SetupCard>
      <SetupCard title="Recipient">
        <RecipientPicker />
      </SetupCard>
      {/* <SetupCard title="Advanced"></SetupCard> */}
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
  // TODO explore custom assets
  return (
    <div>
      <Select
        value={selectedAsset ? assetKey(selectedAsset) : ""}
        onValueChange={(v) => changeAsset(assets[v])}
      >
        <SelectTrigger className="flex-2 focus:ring-0 not-last:rounded-r-none not-last:border-r-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(assets).map(([key, asset]) => (
            <SelectItem value={key} key={key}>
              <div>{asset.symbol}</div>
              <div>{asset.assetId}</div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div>Balance: {balance?.toLocaleString()}</div>
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
  // TODO explore custom assets
  return (
    <div>
      <Select
        value={selectedDest ?? ""}
        onValueChange={(v) => changeDest(v as TChain)}
      >
        <SelectTrigger className="flex-2 focus:ring-0 not-last:rounded-r-none not-last:border-r-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {chains.map((chain, i) => (
            <SelectItem value={chain} key={i}>
              {chain}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
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
  return (
    <Input
      type="number"
      value={amount}
      onChange={(evt) => changeAmount(evt.target.value)}
    />
  )
}

const [recipient$, setRecipient] = createState<string | null>(null)
const RecipientPicker = () => {
  const recipient = useStateObservable(recipient$)

  return (
    <AddressInput
      triggerClassName="h-9 bg-input"
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

const SetupCard: FC<PropsWithChildren<{ title: string }>> = ({
  title,
  children,
}) => (
  <div>
    <div>{title}</div>
    {children}
  </div>
)
