import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Link } from "@/hashParams"
import { useStateObservable } from "@react-rxjs/core"
import {
  Activity,
  CheckLine,
  CircleX,
  Dock,
  History,
  Hourglass,
  PanelRightOpen,
  Pin,
  X,
} from "lucide-react"
import {
  ComponentType,
  FC,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"
import { twMerge } from "tailwind-merge"
import {
  OperationStatus,
  hasPinnedWorkspaceEntries$,
  pinWorkspaceEntry,
  removeWorkspaceEntry,
  setWorkspaceFilter,
  setWorkspaceDocked,
  setWorkspaceOpen,
  workspaceDocked$,
  workspaceEntries$,
  workspaceFilter$,
  WorkspaceEntry,
  workspaceOpen$,
  workspaceSources$,
} from "./workspace.state"

export const HistoryDrawerTrigger: FC = () => {
  const open = useStateObservable(workspaceOpen$)
  const docked = useStateObservable(workspaceDocked$())
  const isDockedViewport = useIsDockedViewport()
  const effectiveDocked = docked && isDockedViewport

  return open && effectiveDocked ? null : (
    <Button
      variant="ghost"
      size="icon"
      className={twMerge("relative shrink-0 text-foreground hover:bg-accent")}
      onClick={() => setWorkspaceOpen(true)}
      aria-label="Open workspace"
    >
      <History className="h-5 w-5" />
    </Button>
  )
}

export const HistoryDrawer = () => {
  const open = useStateObservable(workspaceOpen$)
  const docked = useStateObservable(workspaceDocked$())
  const workspaceEntries = useStateObservable(workspaceEntries$)
  const workspaceFilter = useStateObservable(workspaceFilter$)
  const workspaceSources = useStateObservable(workspaceSources$)
  const hasPinnedWorkspaceEntries = useStateObservable(
    hasPinnedWorkspaceEntries$,
  )
  const isDockedViewport = useIsDockedViewport()
  const effectiveDocked = docked && isDockedViewport
  const drawerRef = useRef<HTMLElement>(null)

  const closeHistory = useCallback(() => {
    const activeElement = document.activeElement
    if (
      activeElement instanceof HTMLElement &&
      drawerRef.current?.contains(activeElement)
    ) {
      // Move focus out before hiding the drawer; otherwise the browser warns
      // about hiding an element that still contains the focused control.
      activeElement.blur()
    }
    setWorkspaceOpen(false)
  }, [])

  useEffect(() => {
    if (!open || effectiveDocked) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeHistory()
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [closeHistory, effectiveDocked, open])

  return (
    <>
      {open && !effectiveDocked ? (
        // Transparent backdrop that captures clicks outside the undocked drawer.
        // It intentionally has no visual overlay so the page stays readable.
        <button
          className="fixed inset-0 z-30 cursor-default bg-transparent"
          onClick={closeHistory}
          aria-label="Close workspace"
        />
      ) : null}
      <aside
        ref={drawerRef}
        aria-label="Workspace"
        inert={!open}
        className={twMerge(
          "fixed inset-y-0 right-0 z-40 flex w-[min(92vw,28rem)] translate-x-full flex-col border-l bg-background shadow-xl transition-transform duration-200",
          docked &&
            "xl:static xl:z-auto xl:h-screen xl:translate-x-0 xl:shadow-none",
          open ? "translate-x-0" : "pointer-events-none",
          !open && effectiveDocked && "xl:hidden",
        )}
      >
        <div className="flex h-16 items-center gap-1 border-b px-4 py-3">
          <h2 className="text-base font-semibold flex-1">Workspace</h2>
          <Button
            variant="ghost"
            size="icon"
            className="hidden h-8 w-8 xl:inline-flex"
            onClick={() => setWorkspaceDocked(!docked)}
            title={docked ? "Undock workspace" : "Dock workspace"}
            aria-label={docked ? "Undock workspace" : "Dock workspace"}
          >
            {docked ? <PanelRightOpen size={16} /> : <Dock size={16} />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 shrink-0"
            disabled={!workspaceEntries.length}
            onClick={() =>
              workspaceEntries.forEach((entry) =>
                removeWorkspaceEntry(entry.data.id),
              )
            }
          >
            Clear
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={closeHistory}
            aria-label="Close workspace drawer"
          >
            <X size={16} />
          </Button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center gap-2 overflow-x-auto border-b px-4 py-2">
            <WorkspaceFilterBadge
              active={workspaceFilter === null}
              onClick={() => setWorkspaceFilter(null)}
            >
              All
            </WorkspaceFilterBadge>
            {hasPinnedWorkspaceEntries ? (
              <WorkspaceFilterBadge
                active={workspaceFilter === "pinned"}
                onClick={() => setWorkspaceFilter("pinned")}
              >
                Pinned
              </WorkspaceFilterBadge>
            ) : null}
            {workspaceSources.map((source) => (
              <WorkspaceFilterBadge
                key={source}
                active={workspaceFilter === source}
                onClick={() => setWorkspaceFilter(source)}
              >
                {source}
              </WorkspaceFilterBadge>
            ))}
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
            {workspaceEntries.map((entry) => (
              <OperationCard key={entry.data.id} entry={entry} />
            ))}
          </div>
        </div>
      </aside>
    </>
  )
}

const WorkspaceFilterBadge: FC<{
  active: boolean
  onClick: () => void
  children: string
}> = ({ active, onClick, children }) => (
  <Badge
    asChild
    variant={active ? "default" : "outline"}
    className={twMerge(
      "cursor-pointer select-none",
      active && "bg-polkadot-500 text-white",
    )}
  >
    <button type="button" onClick={onClick}>
      {children}
    </button>
  </Badge>
)

const DOCKED_DRAWER_MEDIA_QUERY = "(min-width: 80rem)"
const useIsDockedViewport = () => {
  const [isDockedViewport, setIsDockedViewport] = useState(() =>
    typeof window === "undefined"
      ? false
      : window.matchMedia(DOCKED_DRAWER_MEDIA_QUERY).matches,
  )

  useEffect(() => {
    const mediaQuery = window.matchMedia(DOCKED_DRAWER_MEDIA_QUERY)
    const updateDockedViewport = () => setIsDockedViewport(mediaQuery.matches)

    updateDockedViewport()
    mediaQuery.addEventListener("change", updateDockedViewport)
    return () => mediaQuery.removeEventListener("change", updateDockedViewport)
  }, [])

  return isDockedViewport
}

const OperationCard: FC<{ entry: WorkspaceEntry }> = ({ entry }) => {
  const {
    icon: Icon,
    source,
    title,
    subtitle,
    content: Content,
    link,
  } = entry.data

  return (
    <article className="rounded-md border bg-card text-card-foreground shadow-xs">
      <div className="flex items-start gap-3 border-b px-3 py-2.5">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
          <Icon size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {source}
            </span>
            <StatusBadge status={entry.status} />
          </div>
          <div className="mt-1 truncate text-sm font-medium">
            {link ? (
              <Link to={link} className="underline">
                {title}
              </Link>
            ) : (
              title
            )}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {subtitle}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            className={twMerge(
              "rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              entry.pinned
                ? "border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 dark:text-sky-300"
                : null,
            )}
            aria-label={`Pin ${title}`}
            onClick={() => pinWorkspaceEntry(entry.data.id)}
          >
            <Pin size={14} />
          </button>
          <button
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            aria-label={`Remove ${title}`}
            onClick={() => removeWorkspaceEntry(entry.data.id)}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <dl className="max-h-[30svh] overflow-auto">
        <Content id={entry.data.id} context={entry.data.context} />
      </dl>
    </article>
  )
}

const StatusBadge: FC<{ status?: OperationStatus }> = ({ status }) => {
  if (!status) return null
  const Icon = statusIcons[status]

  return (
    <span
      className={twMerge(
        "inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium leading-none",
        statusClasses[status],
      )}
    >
      <Icon size={11} />
      {statusLabels[status]}
    </span>
  )
}

const statusLabels: Record<OperationStatus, string> = {
  live: "Live",
  pending: "Pending",
  done: "Done",
  error: "Error",
}

const statusIcons: Record<
  OperationStatus,
  ComponentType<{ size?: number; className?: string }>
> = {
  live: Activity,
  pending: Hourglass,
  done: CheckLine,
  error: CircleX,
}

const statusClasses: Record<OperationStatus, string> = {
  live: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  pending:
    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  done: "border-muted bg-muted text-muted-foreground",
  error: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
}
