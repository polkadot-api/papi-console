import { useState } from "react"
import { getHashParams, setHashParams } from "../hashParams"

interface Parser<T> {
  stringify: (value: T) => string | null
  parse: (value: string) => T
}
interface ExternalState {
  hasValue: (key: string) => boolean
  getValue: (key: string) => string
  setValue: (key: string, value: string) => void
  deleteValue: (key: string) => void
}

type ValueOrReducer<T> = T | ((prev: T) => T)
const createExternalStateHook = (externalState: ExternalState) => {
  function useExternalState(
    key: string,
    defaultValue: string,
  ): [string, (newValue: ValueOrReducer<string | null>) => void]
  function useExternalState<T>(
    key: string,
    defaultValue: T,
    parser: Parser<T>,
  ): [T, (newValue: ValueOrReducer<T>) => void]
  function useExternalState<T>(
    key: string,
    defaultValue: T,
    parser: Parser<T> = {
      stringify: (value) => (value == null ? null : String(value)),
      parse: (value) => value as T,
    },
  ) {
    const [_state, _setState] = useState(() =>
      externalState.hasValue(key)
        ? parser.parse(externalState.getValue(key))
        : defaultValue,
    )

    return [
      _state,
      (newValue: ValueOrReducer<T>) => {
        _setState((prev) => {
          const value: T =
            typeof newValue === "function" ? (newValue as any)(prev) : newValue

          const strValue = parser.stringify(value)
          if (strValue != null) {
            externalState.setValue(key, strValue)
          } else {
            externalState.deleteValue(key)
          }
          return value
        })
      },
    ]
  }
  return useExternalState
}

const sessionState: ExternalState = {
  hasValue: (key: string) => sessionStorage.getItem(key) != null,
  getValue: (key: string) => sessionStorage.getItem(key) ?? "",
  setValue: (key: string, value: string) => sessionStorage.setItem(key, value),
  deleteValue: (key: string) => sessionStorage.removeItem(key),
}
export const useSessionState = createExternalStateHook(sessionState)

const hashState: ExternalState = {
  hasValue: (key: string) => getHashParams().has(key),
  getValue: (key: string) => getHashParams().get(key)!,
  setValue: (key: string, value: string) => setHashParams({ [key]: value }),
  deleteValue: (key: string) => setHashParams({ [key]: null }),
}
export const useHashState = createExternalStateHook(hashState)

const sessionHashState: ExternalState = {
  hasValue: (key: string) =>
    hashState.hasValue(key) || sessionState.hasValue(key),
  getValue: (key: string) =>
    hashState.getValue(key) ?? sessionState.getValue(key),
  setValue: (key: string, value: string) => {
    hashState.setValue(key, value)
    sessionState.setValue(key, value)
  },
  deleteValue: (key: string) => {
    hashState.deleteValue(key)
    sessionState.deleteValue(key)
  },
}
export const useHashSessionState = createExternalStateHook(sessionHashState)
