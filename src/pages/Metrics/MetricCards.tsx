import { useStateObservable, withDefault } from "@react-rxjs/core"
import {
  ArrowRight,
  Clock3,
  Flag,
  Network,
  Scale,
  ShieldCheck,
} from "lucide-react"
import { FC, PropsWithChildren, ReactNode, useMemo } from "react"
import { filter, map, scan } from "rxjs"
import { DataChart } from "./DataChart"
import { ForkChart } from "./ForkChart"
import { nodeHealth$ } from "./NodeHealth"
import {
  formatDuration,
  formatInteger,
  formatPercent,
  nodeStatusText,
  toSeconds,
} from "./format"
import {
  WINDOW_SIZE,
  blockFinalization$,
  blockTimes$,
  blockWeights$,
  eventsCount$,
  transactionCount$,
  withDefer,
} from "./metrics.state"

const MetricCard: FC<
  PropsWithChildren<{
    title: string
    value: string
    caption: string
    icon: ReactNode
  }>
> = ({ title, value, caption, icon, children }) => (
  <article className="min-h-36 rounded-lg border bg-card p-5 shadow-sm">
    <div className="mb-3 flex items-start justify-between gap-4">
      <h2 className="text-sm font-semibold text-card-foreground">{title}</h2>
      <div className="text-muted-foreground">{icon}</div>
    </div>
    <div className="flex items-center gap-4 overflow-hidden">
      <div className="min-w-0 w-32">
        <div className="text-3xl font-semibold leading-tight tabular-nums">
          {value}
        </div>
        <div className="mt-1 text-sm text-muted-foreground">{caption}</div>
      </div>
      {children ? <div className="flex-1">{children}</div> : null}
    </div>
  </article>
)

export const BlockTimeMetrics = () => {
  const blockTimes = useStateObservable(blockTimes$)
  const avgBlockTime = useMemo(() => {
    // blocks is an array that starts at "block_number". filter makes it 0-based instead, which is what we need
    const blocks = blockTimes.filter((v) =>
      Object.values(v).some((v) => v.blockTime != null),
    )
    if (blocks.length < 3) return null
    // We're skipping the first one since it's very often an outlier
    const first = Object.values(blocks[1]).find((v) => v.blockTime != null)!
    const last = Object.values(blocks.at(-1)!).find((v) => v.blockTime != null)!
    return (last.created! - first.created!) / (blocks.length - 2)
  }, [blockTimes])

  return (
    <MetricCard
      title="Block time"
      value={formatDuration(avgBlockTime)}
      caption={`avg over last ${WINDOW_SIZE} blocks`}
      icon={<Clock3 className="h-5 w-5" />}
    >
      <ForkChart
        color="#ec4899"
        blocks={blockTimes}
        select={(block) => toSeconds(block.blockTime)}
      />
    </MetricCard>
  )
}

export const FinalizationMetrics = () => {
  const finalityTimes = useStateObservable(blockFinalization$)
  const avgFinalizedTime = useMemo(() => {
    const blocks = finalityTimes
      // blocks is an array that starts at "block_number". filter makes it 0-based instead, which is what we need
      .filter((v) =>
        Object.values(v).some(
          (v) => v.finalized !== null && v.finalizedSum != null,
        ),
      )
    if (blocks.length < 3) return null
    // We're skipping the first one since it's very often an outlier
    const first = Object.values(blocks[1]).find(
      (v) => v.finalized !== null && v.finalizedSum != null,
    )!
    const last = Object.values(blocks.at(-1)!).find(
      (v) => v.finalized !== null && v.finalizedSum != null,
    )!
    return (last.finalizedSum! - first.finalizedSum!) / (blocks.length - 2)
  }, [finalityTimes])

  return (
    <MetricCard
      title="Finalization time"
      value={formatDuration(avgFinalizedTime)}
      caption={`avg over last ${WINDOW_SIZE} blocks`}
      icon={<ShieldCheck className="h-5 w-5" />}
    >
      <ForkChart
        color="#ec4899"
        blocks={finalityTimes}
        select={(block) => toSeconds(block.finalized)}
      />
    </MetricCard>
  )
}

export const WeightMetrics = () => {
  const blockWeights = useStateObservable(blockWeights$)
  const avgBlockWeight = useMemo(() => {
    if (!blockWeights) return null
    // blocks is an array that starts at "block_number". filter makes it 0-based instead, which is what we need
    const blocks = blockWeights.filter((v) =>
      Object.values(v).some((v) => v.weightSum !== null),
    )
    if (blocks.length < 2) return null

    // Although we might match different branches, they happen very randomly and we're
    // computing a long average, so the difference will be minimal.
    const first = Object.values(blocks[0]).find((v) => v.weightSum != null)!
    const last = Object.values(blocks.at(-1)!).find(
      (v) => v.weightSum !== null,
    )!
    return {
      refTime:
        (last.weightSum!.refTime - first.weightSum!.refTime) /
        (blocks.length - 1),
      proofSize:
        (last.weightSum!.proofSize - first.weightSum!.proofSize) /
        (blocks.length - 1),
    }
  }, [blockWeights])

  const avgWeight =
    avgBlockWeight &&
    Math.max(avgBlockWeight.refTime, avgBlockWeight.proofSize) * 100

  return (
    <MetricCard
      title="Block weight"
      value={formatPercent(avgWeight)}
      caption="of max block weight"
      icon={<Scale className="h-5 w-5" />}
    >
      <ForkChart
        color="#e6007a"
        blocks={blockWeights}
        select={(block) =>
          block.weight
            ? Math.max(block.weight.refTime, block.weight.proofSize) * 100
            : null
        }
      />
    </MetricCard>
  )
}

export const TransactionMetrics = () => {
  const transactionCounts = useStateObservable(transactionCount$)
  const transactionStats = useMemo(() => {
    const blocks = transactionCounts
      // blocks is an array that starts at "block_number". filter makes it 0-based instead, which is what we need
      .filter((v) => Object.values(v).some((v) => v.transactionSum !== null))
    if (blocks.length < 2) return null

    const first = Object.values(blocks[0]).find(
      (v) => v.transactionSum != null,
    )!
    const last = Object.values(blocks.at(-1)!).find(
      (v) => v.transactionSum !== null,
    )!
    const totalCount = last.transactionSum! - first.transactionSum!
    const tpm = (totalCount * (1000 * 60)) / (last.created - first.created)
    return { totalCount, tpm }
  }, [transactionCounts])

  return (
    <MetricCard
      title="Transactions"
      value={formatInteger(transactionStats?.totalCount)}
      caption={`${formatInteger(transactionStats?.tpm)} tx/min`}
      icon={<ArrowRight className="h-5 w-5" />}
    >
      <ForkChart
        color="#8b5cf6"
        blocks={transactionCounts}
        select={(block) => block.transactions}
      />
    </MetricCard>
  )
}

export const EventMetrics = () => {
  const eventsCount = useStateObservable(eventsCount$)

  const eventStats = useMemo(() => {
    const blocks = eventsCount
      // blocks is an array that starts at "block_number". filter makes it 0-based instead, which is what we need
      .filter((v) => Object.values(v).some((v) => v.eventSum !== null))
    if (blocks.length < 2) return null

    const first = Object.values(blocks[0]).find((v) => v.eventSum != null)!
    const last = Object.values(blocks.at(-1)!).find((v) => v.eventSum !== null)!
    const totalCount = last.eventSum! - first.eventSum!
    const epm = (totalCount * (1000 * 60)) / (last.created - first.created)
    return { totalCount, epm }
  }, [eventsCount])

  return (
    <MetricCard
      title="Events"
      value={formatInteger(eventStats?.totalCount)}
      caption={`${formatInteger(eventStats?.epm)} events/min`}
      icon={<Flag className="h-5 w-5" />}
    >
      <ForkChart
        color="#8b5cf6"
        blocks={eventsCount}
        select={(block) => block.events}
      />
    </MetricCard>
  )
}

const peerHistory$ = nodeHealth$.pipeState(
  map((v) => v?.peers ?? null),
  filter((v) => v != null),
  withDefer(() =>
    scan(
      (acc: number[], newValue) => [newValue, ...acc].slice(0, WINDOW_SIZE),
      [],
    ),
  ),
  map((v) => [...v].reverse()),
  withDefault([]),
)
export const NodeStatusMetrics = () => {
  const peerHistory = useStateObservable(peerHistory$)
  const nodeHealth = useStateObservable(nodeHealth$)

  return (
    <MetricCard
      title="Connected peers"
      value={formatInteger(nodeHealth?.peers)}
      caption={nodeHealth ? nodeStatusText(nodeHealth) : "unavailable"}
      icon={<Network className="h-5 w-5" />}
    >
      <DataChart color="#8b5cf6" values={peerHistory} />
    </MetricCard>
  )
}
