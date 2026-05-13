import { FC, useLayoutEffect } from "react"
import {
  LinkProps,
  NavigateFunction,
  NavigateOptions,
  Link as RouterLink,
  Location as RouterLocation,
  To,
  useLocation,
  useNavigate as useRouterNavigate,
} from "react-router-dom"

export const getHashParams = (location?: Location | RouterLocation) => {
  location = location ?? globalThis.location
  if (location.hash) return new URLSearchParams(location.hash.slice(1))
  return new URLSearchParams()
}

export const setHashParams = (
  newParams: Record<string, string | null>,
  location?: Location | RouterLocation,
) => {
  const params = getHashParams(location)

  Object.entries(newParams).forEach(([param, value]) => {
    if (value === null) params.delete(param)
    else params.set(param, value)
  })

  location = location ?? globalThis.location
  location.hash = "#" + params.toString()
}

const persistingKeys = ["networkId", "endpoint", "chopsticks"]

const usePersistKeys = () => {
  const location = useLocation()
  const originalParams = getHashParams(location)

  const appendParams = (hash: string) => {
    const parsedParams = new URLSearchParams(hash.slice(1))
    persistingKeys.forEach(
      (key) =>
        originalParams.has(key) &&
        !parsedParams.has(key) &&
        parsedParams.set(key, originalParams.get(key)!),
    )
    return "#" + parsedParams.toString()
  }

  return (to: To): To => {
    if (typeof to === "string") {
      const idx = to.indexOf("#")
      return (idx < 0 ? to : to.slice(0, idx)) + appendParams(to.slice(idx))
    }

    return to.hash
      ? {
          ...to,
          hash: appendParams(to.hash),
        }
      : to
  }
}

export const Link: FC<LinkProps & React.RefAttributes<HTMLAnchorElement>> = (
  props,
) => {
  const persistKeys = usePersistKeys()

  return <RouterLink {...props} to={persistKeys(props.to)} />
}

export const useNavigate = (): NavigateFunction => {
  const persistKeys = usePersistKeys()
  const navigate = useRouterNavigate()

  return (toOrDelta: number | To, options?: NavigateOptions) => {
    if (typeof toOrDelta === "number") {
      return navigate(toOrDelta)
    }
    return navigate(persistKeys(toOrDelta), options)
  }
}

export const useSyncHashParam = <T extends any[]>(
  key: string,
  dependencies: T,
  getFn: (...args: T) => string | null,
) => {
  const location = useLocation()

  useLayoutEffect(
    () =>
      setHashParams({
        [key]: getFn(...dependencies),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    dependencies,
  )

  return getHashParams(location).get(key)
}

export const useHashParam = (key: string) =>
  getHashParams(useLocation()).get(key)!

export const useHashParamState = <T extends string | null>(
  key: string,
  init?: () => T,
): [
  null extends T ? string | null : string,
  (value: string | null) => void,
] => {
  const location = useLocation()

  return [
    getHashParams(location).get(key) ?? init?.() ?? (null as any),
    (value: string | null) => setHashParams({ [key]: value }),
  ] as const
}
