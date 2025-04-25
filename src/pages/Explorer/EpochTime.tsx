import { CircularProgress } from "@/components/CircularProgress"
import { groupBy } from "@/lib/groupBy"
import { chainClient$, client$, runtimeCtx$ } from "@/state/chains/chain.state"
import { state, useStateObservable } from "@react-rxjs/core"
import {
  catchError,
  combineLatest,
  distinctUntilChanged,
  EMPTY,
  map,
  of,
  switchMap,
  withLatestFrom,
} from "rxjs"
import { targetBlockTime$ } from "./blockTime.state"

const bestBlock$ = client$.pipeState(
  // Only count when increasing height
  switchMap((client) => client.bestBlocks$),
  map(([block]) => block.number),
  distinctUntilChanged((prev, current) => prev >= current),
)

const epochFromConstant$ = runtimeCtx$.pipe(
  map(({ lookup, dynamicBuilder }) => {
    const palletsByName = groupBy(lookup.metadata.pallets, (p) => p.name)
    const getConstant = (pallet: string, constant: string) =>
      palletsByName[pallet]?.[0]?.constants.find((ct) => ct.name === constant)
    const ct = getConstant("Babe", "EpochDuration")
    if (!ct) return null
    try {
      const res = dynamicBuilder.buildDefinition(ct.type).dec(ct.value)
      return Number(res)
    } catch (_) {
      return null
    }
  }),
)
const epochFromCall$ = runtimeCtx$.pipe(
  withLatestFrom(chainClient$),
  switchMap(([{ lookup }, { client }]) => {
    const getFromApi = (apiName: string, apiMethod: string) => {
      const hasApi =
        "apis" in lookup.metadata &&
        lookup.metadata.apis
          .find((api) => api.name === apiName)
          ?.methods.find((method) => method.name === apiMethod)

      return hasApi ? client.getUnsafeApi().apis[apiName][apiMethod]() : null
    }
    return (
      getFromApi("BabeApi", "configuration")?.then((r) =>
        Number(r.epoch_length),
      ) ?? of(null)
    )
  }),
)
const epochDuration$ = state(
  epochFromConstant$.pipe(switchMap((v) => (v ? of(v) : epochFromCall$))),
)

const epochStartBlock$ = state(
  runtimeCtx$.pipe(
    withLatestFrom(chainClient$),
    switchMap(([{ lookup }, { client }]) => {
      const pallet = "Babe"
      const entry = "EpochStart"
      const hasEntry = lookup.metadata.pallets
        .find(({ name }) => name === pallet)
        ?.storage?.items.find(({ name }) => name === entry)
      return hasEntry
        ? client
            .getUnsafeApi()
            .query[pallet][entry].watchValue()
            .pipe(map(([, duration]) => Number(duration)))
        : of(null)
    }),
  ),
)

const timeProps$ = state(
  combineLatest([
    bestBlock$,
    targetBlockTime$,
    epochDuration$,
    epochStartBlock$,
  ]).pipe(
    map(([bestBlock, targetTime, epochDuration, epochStartBlock]) => {
      if (
        targetTime == null ||
        epochDuration == null ||
        epochStartBlock == null
      )
        return {
          percent: "0%",
          time: "0",
          progress: null,
        }

      const remaining =
        ((epochDuration + epochStartBlock - bestBlock) * targetTime) / 1000
      const hours = Math.floor(remaining / 3600)
      const mins = Math.ceil((remaining % 3600) / 60)
      const time =
        remaining < 60
          ? "<1 min"
          : (hours !== 0 ? `${hours}h` : "") + (mins !== 0 ? `${mins}min` : "")
      const progress = (bestBlock - epochStartBlock) / epochDuration
      return {
        time,
        percent: `${Math.round(progress * 100)}%`,
        progress: progress ? Math.round(progress * 100) / 100 : null,
      }
    }),
    distinctUntilChanged((a, b) => a.time === b.time),
    catchError((err) => {
      console.error("caught error", err)
      return EMPTY
    }),
  ),
  {
    percent: "0%",
    time: "0",
    progress: null,
  },
)
export const EpochRemainingTime = () => {
  const { time, progress, percent } = useStateObservable(timeProps$)

  return (
    <div className="flex gap-2 items-center">
      <CircularProgress
        progress={progress}
        text={progress != null ? percent : ""}
      />
      {progress != null ? (
        <div className="flex flex-col items-center">
          <span>{time}</span>
          <span>remaining</span>
        </div>
      ) : null}
    </div>
  )
}
