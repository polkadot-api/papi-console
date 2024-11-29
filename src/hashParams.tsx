import { FC } from "react"
import {
  LinkProps,
  Path,
  Link as RouterLink,
  Location as RouterLocation,
  useLocation,
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

const persistingKeys = ["networkId", "endpoint"]
export const Link: FC<LinkProps & React.RefAttributes<HTMLAnchorElement>> = (
  props,
) => {
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

  const persistKeys = (to: Partial<Path> | string): Partial<Path> | string => {
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
  return <RouterLink {...props} to={persistKeys(props.to)} />
}
