import { AccountIdDisplay } from "@/components/AccountIdDisplay"
import { TokenAmount } from "@/components/TokenAmount"
import { Link } from "@/hashParams"
import { useStateObservable } from "@react-rxjs/core"
import { ArrowLeft, LockKeyhole, TriangleAlert } from "lucide-react"
import { SS58String } from "polkadot-api"
import { FC } from "react"
import { useParams } from "react-router-dom"
import { BalanceChart } from "./BalanceChart"
import { TransactionButton } from "./TransactionButton"
import { accountLocks$ } from "./locks.state"
import { IdentifiedLock } from "./lockSources/common"

export const Locks = () => {
  const { accountId } = useParams()

  return (
    <div className="mx-auto w-full max-w-5xl pb-4">
      {accountId ? (
        <LocksContent accountId={accountId} />
      ) : (
        <EmptyState
          title="Missing account"
          description="No account was provided."
        />
      )}
    </div>
  )
}

const LocksContent: FC<{ accountId: SS58String }> = ({ accountId }) => {
  const locks = useStateObservable(accountLocks$(accountId))

  return (
    <div className="space-y-4">
      <LocksHeader />

      {!locks ? (
        <EmptyState
          title="Loading locks"
          description="Reading freezes, holds, and reserved balance."
        />
      ) : (
        <>
          <BalanceChart locks={locks} />
          <LockSection title="Reserved balance" locks={locks.reserves} />
          <LockSection title="Frozen balance" locks={locks.freezes} />
        </>
      )}
    </div>
  )
}

const LocksHeader = () => {
  const { accountId } = useParams()

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        <Link
          to="/accounts"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Accounts
        </Link>
        <h2 className="text-xl font-semibold">Account locks</h2>
      </div>
      <AccountIdDisplay value={accountId!} className="min-w-0 sm:max-w-md" />
    </div>
  )
}

const LockSection: FC<{ title: string; locks: IdentifiedLock[] }> = ({
  title,
  locks,
}) =>
  locks.length ? (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold uppercase text-muted-foreground">
        {title}
      </h3>
      {locks.map((lock, i) => (
        <LockCard lock={lock} key={i} />
      ))}
    </section>
  ) : null

const LockCard: FC<{ lock: IdentifiedLock }> = ({ lock }) => {
  const unlockable = lock.unlockable.reduce(
    (acc, action) => acc + (action.tx ? action.amount : 0n),
    0n,
  )

  return (
    <article className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <LockKeyhole className="h-4 w-4 text-muted-foreground" />
          <h4 className="font-semibold">{lock.id}</h4>
        </div>
        <div className="flex flex-wrap text-sm gap-x-4">
          {unlockable > 0n ? (
            <AmountRow label="Unlockable" value={unlockable} />
          ) : null}
          <AmountRow label="Locked" value={lock.amount} />
        </div>
      </div>
      {lock.note ? (
        <p className="text-sm text-muted-foreground">{lock.note}</p>
      ) : null}

      {lock.unlockable.length ? (
        <div className="mt-4 space-y-3">
          {lock.unlockable.map((action, i) => (
            <UnlockActionRow key={i} action={action} />
          ))}
        </div>
      ) : null}
    </article>
  )
}

const AmountRow: FC<{ label: string; value: bigint }> = ({ label, value }) => (
  <div className="flex items-center gap-3 rounded-md bg-background/60">
    <div className="text-muted-foreground">{label}</div>
    <TokenAmount className="font-medium">{value}</TokenAmount>
  </div>
)

const UnlockActionRow: FC<{
  action: IdentifiedLock["unlockable"][number]
}> = ({ action }) => (
  <div className="rounded-md border bg-background/60 p-3">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-2">
        <div className="font-medium">{action.action}</div>
        <AmountRow label="Value" value={action.amount} />
        {action.warn ? (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{action.warn}</span>
          </div>
        ) : null}
      </div>
      {action.tx ? <TransactionButton tx={action.tx} /> : null}
    </div>
  </div>
)

const EmptyState: FC<{ title: string; description: string }> = ({
  title,
  description,
}) => (
  <div className="rounded-lg border border-dashed bg-card p-6 text-center">
    <div className="font-medium">{title}</div>
    <div className="mt-1 text-sm text-muted-foreground">{description}</div>
  </div>
)
