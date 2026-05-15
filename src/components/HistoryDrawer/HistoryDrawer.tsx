import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useStateObservable } from "@react-rxjs/core"
import {
  Activity,
  BookOpenText,
  Cable,
  CheckCircle2,
  Clock3,
  Copy,
  DatabaseSearch,
  Dock,
  GitGraph,
  History,
  LoaderCircle,
  PanelRightOpen,
  Pin,
  Send,
  ServerCog,
  SquareEqual,
  SquareFunction,
  X,
} from "lucide-react"
import { ComponentType, FC, useEffect } from "react"
import { twMerge } from "tailwind-merge"
import {
  historyDocked$,
  historyOpen$,
  setHistoryDocked,
  setHistoryOpen,
} from "./historyDrawer.state"

type OperationIcon = ComponentType<{ size?: number; className?: string }>

type OperationStatus = "live" | "finalized" | "pending" | "pinned" | "done"

type OperationCard = {
  id: string
  source: string
  title: string
  subtitle: string
  status: OperationStatus
  icon: OperationIcon
  details: Array<{
    label: string
    value: string
    mono?: boolean
  }>
}

export const HistoryDrawerTrigger: FC = () => {
  const open = useStateObservable(historyOpen$)

  return open ? null : (
    <Button
      variant="ghost"
      size="icon"
      className={twMerge("relative shrink-0 text-foreground hover:bg-accent")}
      onClick={() => setHistoryOpen(true)}
      aria-label="Open workspace"
    >
      <History className="h-5 w-5" />
    </Button>
  )
}

export const HistoryDrawer = () => {
  const open = useStateObservable(historyOpen$)
  const docked = useStateObservable(historyDocked$())

  useEffect(() => {
    if (!open || docked) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setHistoryOpen(false)
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [docked, open])

  return (
    <aside
      aria-label="Workspace"
      aria-hidden={!open}
      className={twMerge(
        "fixed inset-y-0 right-0 z-40 flex w-[min(92vw,28rem)] translate-x-full flex-col border-l bg-background shadow-xl transition-transform duration-200",
        docked &&
          "xl:static xl:z-auto xl:h-screen xl:translate-x-0 xl:shadow-none",
        open ? "translate-x-0" : "pointer-events-none xl:hidden",
      )}
    >
      <div className="flex gap-1 items-center border-b px-4 py-3 h-16">
        <h2 className="text-base font-semibold flex-1">Workspace</h2>
        <Button
          variant="ghost"
          size="icon"
          className="hidden h-8 w-8 xl:inline-flex"
          onClick={() => setHistoryDocked(!docked)}
          title={docked ? "Undock workspace" : "Dock workspace"}
          aria-label={docked ? "Undock workspace" : "Dock workspace"}
        >
          {docked ? <PanelRightOpen size={16} /> : <Dock size={16} />}
        </Button>
        <Button variant="ghost" size="sm" className="h-8 shrink-0">
          Clear
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setHistoryOpen(false)}
          aria-label="Close workspace drawer"
        >
          <X size={16} />
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b px-4 py-2">
          <Badge variant="default" className="bg-polkadot-500 text-white">
            All
          </Badge>
          <Badge variant="outline">Pinned</Badge>
          <Badge variant="outline">Transactions</Badge>
          <Badge variant="outline">Queries</Badge>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
          {mockOperationCards.map((operation) => (
            <OperationCard key={operation.id} operation={operation} />
          ))}
        </div>
      </div>
    </aside>
  )
}

const OperationCard: FC<{ operation: OperationCard }> = ({ operation }) => {
  const Icon = operation.icon

  return (
    <article className="rounded-md border bg-card text-card-foreground shadow-xs">
      <div className="flex items-start gap-3 border-b px-3 py-2.5">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
          <Icon size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {operation.source}
            </span>
            <StatusBadge status={operation.status} />
          </div>
          <div className="mt-1 truncate text-sm font-medium">
            {operation.title}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {operation.subtitle}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            aria-label={`Copy ${operation.title}`}
          >
            <Copy size={14} />
          </button>
          <button
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            aria-label={`Pin ${operation.title}`}
          >
            <Pin size={14} />
          </button>
          <button
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            aria-label={`Remove ${operation.title}`}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <dl className="grid grid-cols-[6rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 px-3 py-2.5 text-xs">
        {operation.details.map((detail) => (
          <div className="contents" key={detail.label}>
            <dt className="text-muted-foreground">{detail.label}</dt>
            <dd
              className={twMerge(
                "min-w-0 truncate text-card-foreground",
                detail.mono && "font-mono",
              )}
            >
              {detail.value}
            </dd>
          </div>
        ))}
      </dl>
    </article>
  )
}

const StatusBadge: FC<{ status: OperationStatus }> = ({ status }) => {
  const Icon = statusIcons[status]

  return (
    <span
      className={twMerge(
        "inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium leading-none",
        statusClasses[status],
      )}
    >
      <Icon size={11} className={status === "pending" ? "animate-spin" : ""} />
      {statusLabels[status]}
    </span>
  )
}

const statusLabels: Record<OperationStatus, string> = {
  live: "Live",
  finalized: "Finalized",
  pending: "Pending",
  pinned: "Pinned",
  done: "Done",
}

const statusIcons: Record<OperationStatus, OperationIcon> = {
  live: Activity,
  finalized: CheckCircle2,
  pending: LoaderCircle,
  pinned: Pin,
  done: Clock3,
}

const statusClasses: Record<OperationStatus, string> = {
  live: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  finalized:
    "border-polkadot-500/30 bg-polkadot-500/10 text-polkadot-700 dark:text-polkadot-300",
  pending:
    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  pinned: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  done: "border-muted bg-muted text-muted-foreground",
}

const mockOperationCards: OperationCard[] = [
  {
    id: "explorer-block",
    source: "Explorer",
    title: "Block 15,749,902",
    subtitle: "Pinned block detail",
    status: "pinned",
    icon: GitGraph,
    details: [
      {
        label: "Hash",
        value: "0x56c8217e87b277ab47feea500fa696f93...",
        mono: true,
      },
      {
        label: "Parent",
        value: "0x98d3808115a79bf3bef09ed62990c264...",
        mono: true,
      },
      { label: "Events", value: "14 events, 3 extrinsics" },
    ],
  },
  {
    id: "explorer-event",
    source: "Explorer",
    title: "Balances.Transfer",
    subtitle: "Pinned event 15,749,900-2",
    status: "pinned",
    icon: GitGraph,
    details: [
      { label: "From", value: "15D4zq...7DfN", mono: true },
      { label: "To", value: "13YH9u...U59a", mono: true },
      { label: "Amount", value: "12.4021 DOT" },
    ],
  },
  {
    id: "storage-live",
    source: "Storage",
    title: "System.Account",
    subtitle: "Live query following best block",
    status: "live",
    icon: DatabaseSearch,
    details: [
      { label: "Key", value: "15D4zq...7DfN", mono: true },
      { label: "Block", value: "15,749,902 -> 15,749,903" },
      { label: "Value", value: "free: 12.4021 DOT, nonce: 91" },
    ],
  },
  {
    id: "extrinsic-submit",
    source: "Extrinsics",
    title: "balances.transferKeepAlive",
    subtitle: "Submitted from account 15D4zq...7DfN",
    status: "pending",
    icon: Send,
    details: [
      { label: "Hash", value: "0xa87f6a6e5df4b58d1f8cd0ce8a97...", mono: true },
      { label: "Status", value: "In block, waiting finality" },
      { label: "Block", value: "15,749,903" },
    ],
  },
  {
    id: "runtime-call",
    source: "Runtime Calls",
    title: "TransactionPaymentApi.query_info",
    subtitle: "Runtime call result",
    status: "done",
    icon: ServerCog,
    details: [
      { label: "Weight", value: "ref_time: 184,235,000" },
      { label: "Class", value: "Normal" },
      { label: "Fee", value: "0.0214 DOT" },
    ],
  },
  {
    id: "view-function",
    source: "View Functions",
    title: "ContractsApi.call",
    subtitle: "View function result",
    status: "done",
    icon: SquareFunction,
    details: [
      { label: "Contract", value: "5Grwva...F25k", mono: true },
      { label: "Result", value: "Ok: 0x00010000000000000000", mono: true },
      { label: "Gas", value: "321,408,092" },
    ],
  },
  {
    id: "constant",
    source: "Constants",
    title: "Balances.ExistentialDeposit",
    subtitle: "Pinned constant value",
    status: "pinned",
    icon: SquareEqual,
    details: [
      { label: "Value", value: "10,000,000,000" },
      { label: "Type", value: "u128" },
      { label: "Pallet", value: "Balances" },
    ],
  },
  {
    id: "metadata",
    source: "Metadata",
    title: "Lookup 42: AccountData",
    subtitle: "Pinned metadata lookup type",
    status: "pinned",
    icon: BookOpenText,
    details: [
      { label: "Path", value: "pallet_balances.types.AccountData" },
      { label: "Fields", value: "free, reserved, frozen, flags" },
      { label: "Codec", value: "struct" },
    ],
  },
  {
    id: "rpc",
    source: "RPC Calls",
    title: "chain_getHeader",
    subtitle: "RPC call result",
    status: "done",
    icon: Cable,
    details: [
      {
        label: "Hash",
        value: "0x56c8217e87b277ab47feea500fa696f93...",
        mono: true,
      },
      { label: "Number", value: "0x00f0594e", mono: true },
      {
        label: "Parent",
        value: "0x98d3808115a79bf3bef09ed62990c264...",
        mono: true,
      },
    ],
  },
]
