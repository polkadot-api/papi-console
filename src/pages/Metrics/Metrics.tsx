import { distinctUntilChanged } from "rxjs"
import { CenteredScrollContainer } from "../AppShell"
import {
  avgBlockTime$,
  avgBlockWeight$,
  avgFinalizedTime$,
  transactionsStats$,
} from "./metrics.state"

avgBlockTime$
  .pipe(distinctUntilChanged())
  .subscribe((r) => console.log("avg block times", r))
avgFinalizedTime$
  .pipe(distinctUntilChanged())
  .subscribe((r) => console.log("avg finalized times", r))
transactionsStats$
  .pipe(distinctUntilChanged((a, b) => a?.totalCount === b?.totalCount))
  .subscribe((r) => console.log("txs", r))
avgBlockWeight$
  .pipe(distinctUntilChanged((a, b) => a?.proofSize === b?.proofSize))
  .subscribe((r) => console.log("bw", r))

export default function Metrics() {
  return <CenteredScrollContainer></CenteredScrollContainer>
}
