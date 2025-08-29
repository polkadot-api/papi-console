import { AccountIdDisplay } from "@/components/AccountIdDisplay"
import { TokenAmount } from "@/components/TokenAmount"
import { Button } from "@/components/ui/button"
import { Account, accounts$, AccountSource } from "@/state/accounts.state"
import { chainProperties$ } from "@/state/chain-props.state"
import { client$ } from "@/state/chains/chain.state"
import { MultiAddress, polkadot_people } from "@polkadot-api/descriptors"
import {
  liftSuspense,
  sinkSuspense,
  state,
  useStateObservable,
} from "@react-rxjs/core"
import { Send } from "lucide-react"
import { CompatibilityLevel, SS58String } from "polkadot-api"
import { FC } from "react"
import { Link } from "react-router-dom"
import { catchError, combineLatest, map, switchMap } from "rxjs"
import { knownExtensions } from "./Providers"

export const AccountList = () => {
  const accounts = useStateObservable(accounts$)

  return (
    <div className="p-4">
      <h3 className="text-xl font-bold">Accounts</h3>
      <ul className="space-y-4">
        {accounts.map((account, i) => (
          <AccountCard key={i} account={account} />
        ))}
      </ul>
    </div>
  )
}

const AccountCard: FC<{
  account: Account
}> = ({ account }) => {
  return (
    <li className="shadow rounded-xl p-4 space-y-4">
      <div className="flex justify-between items-start overflow-hidden">
        <AccountIdDisplay
          value={account.accountId}
          className="shrink-1 overflow-hidden"
        />
        <SourceTag account={account} />
      </div>
      {account.accountId.startsWith("0x") ? null : (
        <Balances accountId={account.accountId} />
      )}
    </li>
  )
}

const sourceColors: Record<AccountSource, string> = {
  extension: "var(--color-orange-800)",
  walletconnect: "var(--color-blue-800)",
}
const typeToName: Record<AccountSource, string> = {
  extension: "Extension",
  walletconnect: "Wallet Connect",
}
const getExtensionName = (id: string) => knownExtensions[id]?.name ?? id

const SourceTag: FC<{
  account: Account
}> = ({ account }) => {
  return (
    <div
      className="rounded px-2 shrink-0"
      style={{
        color: sourceColors[account.type],
        backgroundColor: `color-mix(in srgb, ${sourceColors[account.type]}, transparent 90%)`,
      }}
    >
      {account.type === "extension"
        ? getExtensionName(account.extensionId)
        : typeToName[account.type]}
    </div>
  )
}

const typedApi$ = client$.pipeState(map((v) => v.getTypedApi(polkadot_people)))

const balance$ = state(
  (accountId: SS58String) =>
    typedApi$.pipe(
      switchMap((typedApi) =>
        typedApi.query.System.Account.watchValue(accountId),
      ),
      map((account) => {
        const { reserved, free, frozen } = account.data
        const total = reserved + free

        // TODO ED
        const untouchable = total == 0n ? 0n : maxBigInt(frozen - reserved, 0n)

        return {
          total,
          spendable: free - untouchable,
          frozen,
          reserved,
        }
      }),
      liftSuspense(),
      catchError((ex) => {
        console.error(ex)
        return [null]
      }),
      sinkSuspense(),
    ),
  null,
)

const getTransferCallData$ = state(
  combineLatest([typedApi$, chainProperties$]).pipe(
    switchMap(async ([typedApi, chainProperties]) => {
      const tokenDecimals = chainProperties?.tokenDecimals

      if (tokenDecimals == null) return null
      const token = await typedApi.compatibilityToken

      if (
        !typedApi.tx.Balances.transfer_keep_alive.isCompatible(
          CompatibilityLevel.BackwardsCompatible,
          token,
        )
      ) {
        return null
      }

      return (dest: SS58String) => {
        const value = 10n ** BigInt(tokenDecimals)

        return typedApi.tx.Balances.transfer_keep_alive({
          dest: MultiAddress.Id(dest),
          value,
        })
          .getEncodedData(token)
          .asHex()
      }
    }),
  ),
  null,
)

const Balances: FC<{
  accountId: SS58String
}> = ({ accountId }) => {
  const balance = useStateObservable(balance$(accountId))
  const getTransferCallData = useStateObservable(getTransferCallData$)

  if (!balance) return null

  return (
    <div className="flex flex-row">
      <div className="flex flex-col sm:flex-row justify-evenly grow">
        <div className="flex flex-row sm:flex-col gap-2">
          <div className="text-muted-foreground">Balance</div>
          <div>
            <TokenAmount>{balance.total}</TokenAmount>
          </div>
        </div>
        <div className="flex flex-row sm:flex-col gap-2">
          <div className="text-muted-foreground">Transferable</div>
          <TokenAmount className="text-green-800 font-bold">
            {balance.spendable}
          </TokenAmount>
        </div>
        <div className="flex flex-row sm:flex-col gap-2">
          <div className="text-muted-foreground">Locked</div>
          <TokenAmount className="text-orange-800">
            {balance.total - balance.spendable}
          </TokenAmount>
        </div>
      </div>
      {getTransferCallData ? (
        <Button variant="secondary" asChild>
          <Link to={`/extrinsics#data=${getTransferCallData(accountId)}`}>
            <Send /> Transfer
          </Link>
        </Button>
      ) : null}
    </div>
  )
}

const maxBigInt = (a: bigint, b: bigint) => (a > b ? a : b)
