import { withSubscribe } from "@/components/withSuspense"
import { useStateObservable } from "@react-rxjs/core"
import { AlertTriangle } from "lucide-react"
import { CenteredScrollContainer } from "../AppShell"
import { RoutePreview } from "./RoutePreview"
import { origin$, Setup } from "./Setup"
import { Submit } from "./Submit"

const Teleport = withSubscribe(() => {
  const origin = useStateObservable(origin$)

  if (!origin) {
    // TODO explore custom chains
    return (
      <CenteredScrollContainer className="p-4">
        <div className="mx-auto mt-8 max-w-lg rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-800 dark:text-amber-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <h1 className="font-semibold">Chain not supported</h1>
              <p className="mt-1 text-amber-800/80 dark:text-amber-200/80">
                Teleport is currently available only for chains supported by
                Paraspell.
              </p>
            </div>
          </div>
        </div>
      </CenteredScrollContainer>
    )
  }

  return (
    <CenteredScrollContainer>
      <div className="flex min-h-full flex-col gap-4 p-4">
        <header className="flex flex-col gap-3 @lg:flex-row @lg:items-start @lg:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Teleport</h1>
            <p className="text-sm text-muted-foreground">
              Send assets from the connected chain to a supported destination.
            </p>
          </div>
          <a
            href="https://paraspell.xyz/"
            target="_blank"
            rel="noreferrer"
            className="w-fit shrink-0 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
          >
            Powered by Paraspell ✨
          </a>
        </header>

        <div className="grid min-h-0 gap-4 items-start @5xl:grid-cols-[minmax(0,1fr)_minmax(21rem,0.85fr)] @7xl:grid-cols-[minmax(0,1.05fr)_minmax(24rem,0.95fr)]">
          <Setup />
          <div className="flex min-w-0 flex-col gap-4">
            <RoutePreview />
            <Submit />
          </div>
        </div>
      </div>
    </CenteredScrollContainer>
  )
})
export default Teleport
