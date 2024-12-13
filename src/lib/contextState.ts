import { DefaultedStateObservable, state } from "@react-rxjs/core"
import { Observable } from "rxjs"

type LastOptional<T> = T extends [...infer R, any] ? T | R : T

export function createContextState<Ctx>(hook: () => Ctx) {
  return function _state<A extends [Ctx, ...any[]], O>(
    getObservable: (...args: A) => Observable<O>,
    defaultValue: O | ((...args: A) => O),
  ): (...args: LastOptional<A>) => DefaultedStateObservable<O> {
    const state$: (...args: any[]) => any = state(getObservable, defaultValue)

    return (...args: any[]) =>
      args.length < getObservable.length
        ? state$(...args, hook())
        : state$(...args)
  }
}
