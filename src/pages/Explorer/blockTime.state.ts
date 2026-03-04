import { chainClient$, runtimeCtx$ } from "@/state/chains/chain.state"
import { groupBy } from "@/lib/groupBy"
import { state } from "@react-rxjs/core"
import { map, of, switchMap, withLatestFrom } from "rxjs"

const fromConstants$ = runtimeCtx$.pipe(
  map(({ dynamicBuilder, lookup }) => {
    const palletsByName = groupBy(lookup.metadata.pallets, (p) => p.name)
    const getConstant = (pallet: string, constant: string) =>
      palletsByName[pallet]?.[0]?.constants.find((ct) => ct.name === constant)
    const ct =
      getConstant("Babe", "ExpectedBlockTime") ??
      getConstant("Aura", "SlotDuration")
    if (!ct) return null
    try {
      const res = dynamicBuilder.buildDefinition(ct.type).dec(ct.value)
      return Number(res)
    } catch (_) {
      return null
    }
  }),
)
const fromCall$ = runtimeCtx$.pipe(
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
      getFromApi("AuraApi", "slot_duration")?.then((r) => Number(r)) ??
      getFromApi("BabeApi", "configuration")?.then((r) =>
        Number(r.slot_duration),
      ) ??
      of(null)
    )
  }),
)

export const targetBlockTime$ = state(
  fromConstants$.pipe(switchMap((v) => (v ? of(v) : fromCall$))),
)
