import { CircularProgress } from "@/components/CircularProgress"
import { client$ } from "@/state/chains/chain.state"
import { state, useStateObservable } from "@react-rxjs/core"
import {
  animationFrames,
  combineLatest,
  distinctUntilChanged,
  map,
  switchMap,
} from "rxjs"
import { targetBlockTime$ } from "./blockTime.state"

const best$ = client$.pipeState(
  switchMap((client) => client.bestBlocks$.pipe(map(([best]) => best))),
)
const bestBlockTime$ = best$.pipeState(
  // Only count when increasing height
  map((block) => block.number),
  distinctUntilChanged((prev, current) => prev >= current),
  switchMap(() => {
    const timestamp = Date.now()
    return animationFrames().pipe(map(() => Date.now() - timestamp))
  }),
)

const timeProps$ = state(
  combineLatest([bestBlockTime$, targetBlockTime$]).pipe(
    map(([bestBlockTime, targetTime]) => {
      const time = (Math.round(bestBlockTime / 100) / 10).toFixed(1)
      const progress = targetTime ? bestBlockTime / targetTime : null
      return {
        time,
        progress: progress ? Math.round(progress * 100) / 100 : null,
      }
    }),
    distinctUntilChanged((a, b) => a.time === b.time),
  ),
  {
    time: "0",
    progress: null,
  },
)

export const BlockTime = () => {
  const { time, progress } = useStateObservable(timeProps$)

  return <CircularProgress progress={progress} text={time + "s"} />
}
