import { distinctUntilChanged } from "rxjs"
import { CenteredScrollContainer } from "../AppShell"
import { avgBlockTime$, avgFinalizedTime$ } from "./metrics.state"

avgBlockTime$
  .pipe(distinctUntilChanged())
  .subscribe((r) => console.log("avg block times", r))
avgFinalizedTime$
  .pipe(distinctUntilChanged())
  .subscribe((r) => console.log("avg finalized times", r))

export default function Metrics() {
  return <CenteredScrollContainer></CenteredScrollContainer>
}
