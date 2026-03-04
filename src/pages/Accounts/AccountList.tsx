import { AccountIdDisplay } from "@/components/AccountIdDisplay"
import { TokenAmount } from "@/components/TokenAmount"
import { Button } from "@/components/ui/button"
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
import {
  Account,
  ledgerProviderId,
  PjsWalletAccount,
  polkadotVaultProviderId,
  readOnlyProviderId,
  useAvailableAccounts,
  walletConnectProviderId,
} from "polkahub"
import { FC } from "react"
import { Link } from "react-router-dom"
import { catchError, combineLatest, map, switchMap } from "rxjs"

const knownGroupsNames: Record<string, string> = {
  "pjs-wallet": "Browser Extensions",
  [ledgerProviderId]: "Ledger",
  [readOnlyProviderId]: "Read Only",
  [polkadotVaultProviderId]: "Polkadot Vault",
  [walletConnectProviderId]: "Wallet Connect",
}
const knownGroupsColors: Record<string, string> = {
  "pjs-wallet": "var(--color-lime-700)",
  [readOnlyProviderId]: "var(--color-orange-700)",
  [walletConnectProviderId]: "var(--color-blue-700)",
}

export const AccountList = () => {
  const accountGroups = useAvailableAccounts()

  return (
    <div className="bg-card p-4 rounded-xl space-y-4">
      <h3 className="text-xl font-bold">Accounts</h3>
      {Object.entries(accountGroups)
        .filter(([_, accounts]) => accounts.length > 0)
        .map(([id, accounts]) => (
          <AccountGroup key={id} id={id} accounts={accounts} />
        ))}
    </div>
  )
}

const AccountGroup: FC<{ id: string; accounts: Account[] }> = ({
  id,
  accounts,
}) => {
  return (
    <div>
      <h4>{getGroupName(id)}</h4>
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
    <li className="shadow border rounded-xl p-4 space-y-4">
      <div className="flex justify-between items-start overflow-hidden">
        <AccountIdDisplay
          value={account.address}
          className="shrink-1 overflow-hidden"
        />
        <SourceTag account={account} />
      </div>
      {account.address.startsWith("0x") ? null : (
        <Balances accountId={account.address} />
      )}
    </li>
  )
}
export const knownExtensions: Record<string, string> = {
  "polkadot-js": "Polkadot JS",
  "nova-wallet": "Nova Wallet",
  talisman: "Talisman",
  "subwallet-js": "Subwallet",
}
const getExtensionName = (id: string) => knownExtensions[id] ?? id
const getGroupName = (id: string) => knownGroupsNames[id] ?? id

const SourceTag: FC<{
  account: Account
}> = ({ account }) => {
  return (
    <div
      className="rounded px-2 shrink-0"
      style={
        account.provider in knownGroupsColors
          ? {
              color: knownGroupsColors[account.provider],
              backgroundColor: `color-mix(in srgb, ${knownGroupsColors[account.provider]}, transparent 90%)`,
            }
          : undefined
      }
    >
      {account.provider === "pjs-wallet"
        ? getExtensionName((account as PjsWalletAccount).extensionId)
        : getGroupName(account.provider)}
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
      <div className="flex flex-col sm:flex-row justify-center gap-x-8 grow">
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
