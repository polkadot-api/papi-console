import { Copy } from "lucide-react"
import { FC, ReactNode } from "react"
import { CenteredScrollContainer } from "../AppShell"
import {
  BlockTimeMetrics,
  EventMetrics,
  FinalizationMetrics,
  NodeStatusMetrics,
  TransactionMetrics,
  WeightMetrics,
} from "./MetricCards"
import { NodeStatus } from "./NodeHealth"
import { RecentBlocksTable } from "./RecentBlocks"

export default function Metrics() {
  return (
    <CenteredScrollContainer className="max-w-360">
      <div className="p-4 space-y-5">
        <h1 className="text-2xl font-semibold tracking-normal text-foreground">
          Chain metrics
        </h1>

        <section className="grid gap-4 lg:grid-cols-3">
          <BlockTimeMetrics />
          <FinalizationMetrics />
          <WeightMetrics />
          <TransactionMetrics />
          <EventMetrics />
          <NodeStatusMetrics />
        </section>

        <section className="grid gap-4 xl:grid-cols-[1fr_1.05fr]">
          <Panel title="Recent blocks" action={<Copy className="h-4 w-4" />}>
            <RecentBlocksTable />
          </Panel>

          <Panel title="Node status" action={<Copy className="h-4 w-4" />}>
            <NodeStatus />
          </Panel>
        </section>
      </div>
    </CenteredScrollContainer>
  )
}

const Panel: FC<{
  title: string
  action?: ReactNode
  children: ReactNode
}> = ({ title, action, children }) => (
  <section className="rounded-lg border bg-card shadow-sm">
    <div className="flex h-14 items-center justify-between border-b px-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      {action ? <div className="text-muted-foreground">{action}</div> : null}
    </div>
    <div className="p-5">{children}</div>
  </section>
)
