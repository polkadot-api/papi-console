import { ActionButton } from "@/components/ActionButton"
import { JsonDisplay } from "@/components/JsonDisplay"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { SystemEvent } from "@polkadot-api/observable-client"
import { state, useStateObservable } from "@react-rxjs/core"
import { createSignal } from "@react-rxjs/utils"
import { CheckCircle, CircleAlert, CircleX, Loader2, Play } from "lucide-react"
import { FC, ReactNode, useEffect, useState } from "react"
import { combineLatest, startWith, switchMap, takeUntil } from "rxjs"
import { txValidity$ } from "./Estimates"
import { transaction$, txOptions$ } from "./submit.state"
import { dryRun$ } from "./validate"

const [triggerDryRun$, dryRun] = createSignal()
const [cancelDryRun$, cancelDryRun] = createSignal()
const dryRunResult$ = state(
  triggerDryRun$.pipe(
    switchMap(() =>
      combineLatest([transaction$, txOptions$]).pipe(
        switchMap(([tx, txOptions], idx) => {
          // any late change interrupts and cancels the dry run
          if (idx > 0 || !tx) return [null]

          return dryRun$(tx, txOptions).pipe(
            startWith({
              type: "running" as const,
              value: undefined,
            }),
          )
        }),
        takeUntil(cancelDryRun$),
      ),
    ),
  ),
  null,
)

export const DryRun = () => {
  const validity = useStateObservable(txValidity$)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const sub = dryRunResult$.subscribe()
    return () => sub.unsubscribe()
  }, [])

  const disabled = validity?.type !== "valid"
  const button = (
    <ActionButton
      className="flex w-full items-center justify-center gap-2 rounded-md border border-border bg-background py-2.5 text-sm font-semibold text-foreground hover:bg-foreground/5"
      disabled={disabled}
      type="button"
    >
      <Play className="h-4 w-4" />
      Dry Run
    </ActionButton>
  )

  return disabled ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="w-full cursor-default">{button}</div>
      </TooltipTrigger>
      <TooltipContent>
        Can only dry run transactions that have passed validation
      </TooltipContent>
    </Tooltip>
  ) : (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        setOpen(open)
        if (open) {
          dryRun()
        } else {
          cancelDryRun()
        }
      }}
    >
      <DialogTrigger asChild>{button}</DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Dry Run</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <DryRunModalContent />
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}

const DryRunModalContent: FC = () => {
  const result = useStateObservable(dryRunResult$)
  if (!result || result.type === "no-signer") {
    // Should be unreachable
    return null
  }

  if (result.type === "running") {
    return (
      <div className="flex items-center gap-3 rounded-md border border-dashed border-border bg-background/60 p-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Simulating
      </div>
    )
  }

  if (result.type === "invalid") {
    return (
      <div
        className="rounded-md border border-red-500/30 bg-red-500/5 p-4 text-red-700 dark:text-red-300"
        role="alert"
      >
        <div className="flex items-start gap-2">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0 space-y-2">
            <div className="text-sm font-medium">
              Rejected by transaction validation
            </div>
            <div className="text-sm">
              <JsonDisplay src={result.value} />
            </div>
          </div>
        </div>
      </div>
    )
  }

  const { ok, dispatchError, events } = result.value
  const passed = ok && !dispatchError

  return (
    <div className="space-y-4">
      <div
        className={
          passed
            ? "rounded-md border border-emerald-500/30 bg-emerald-500/5 p-4"
            : "rounded-md border border-red-500/30 bg-red-500/5 p-4"
        }
      >
        <div className="flex items-start gap-2">
          {passed ? (
            <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300" />
          ) : (
            <CircleX className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-300" />
          )}
          <div>
            <div className="text-sm font-medium">
              {passed ? "Transaction succeeded" : "Transaction failed"}
            </div>
          </div>
        </div>
      </div>

      {dispatchError ? (
        <DryRunSection title="Dispatch Error">
          <JsonDisplay src={dispatchError} collapsed={1} />
        </DryRunSection>
      ) : null}

      <DryRunSection title="Events">
        <ol className="divide-y divide-border rounded-md border border-border">
          {events.map((event, index) => (
            <DryRunEvent key={index} event={event} />
          ))}
        </ol>
      </DryRunSection>
    </div>
  )
}

const DryRunSection: FC<{ title: string; children: ReactNode }> = ({
  title,
  children,
}) => (
  <section className="space-y-2">
    <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {title}
    </h3>
    {children}
  </section>
)

type FlattenedEvent = SystemEvent & SystemEvent["event"]
const DryRunEvent: FC<{ event: FlattenedEvent }> = ({ event }) => {
  const [expanded, setExpanded] = useState(false)
  const eventName = getEventName(event)

  return (
    <li>
      <button
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-foreground/5"
        type="button"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="min-w-0 truncate font-mono">{eventName}</span>
      </button>
      {expanded ? (
        <div className="max-h-80 overflow-auto border-t border-border px-3 py-2 bg-foreground/5">
          <JsonDisplay src={event.value.value} />
        </div>
      ) : null}
    </li>
  )
}

const getEventName = (event: FlattenedEvent) => {
  const pallet = event.type
  const name = event.value.type
  return `${pallet}.${name}`
}
