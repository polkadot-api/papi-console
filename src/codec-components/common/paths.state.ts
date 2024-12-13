import { createContextState } from "@/lib/contextState"
import { createKeyedSignal } from "@react-rxjs/utils"
import { createContext, useContext } from "react"
import { map, scan } from "rxjs"

export const PathsRoot = createContext<string>("")

const pathsState = createContextState(() => useContext(PathsRoot))

export const [collapsedToggle$, toggleCollapsed] = createKeyedSignal<
  string,
  string
>()

const collapsedPaths$ = pathsState(
  (id) =>
    collapsedToggle$(id).pipe(
      scan((acc, v) => {
        if (acc.has(v)) acc.delete(v)
        else acc.add(v)
        return acc
      }, new Set<string>()),
    ),
  new Set<string>(),
)

export const isCollapsed$ = pathsState(
  (path: string, id: string) =>
    collapsedPaths$(id).pipe(map((v) => v.has(path))),
  false,
)

/**
 * Returns true if it's a collapsed root.
 * Same as `isCollapsed`, but returns `false` if a parent path is also collapsed.
 */
export const isCollapsedRoot$ = pathsState(
  (path: string, id: string) =>
    collapsedPaths$(id).pipe(
      map((collapsedPaths) => {
        if (!collapsedPaths.has(path)) return false

        return !Array.from(collapsedPaths).some(
          (otherPath) => otherPath !== path && path.startsWith(otherPath),
        )
      }),
    ),
  false,
)

export const [hoverChange$, setHovered] = createKeyedSignal<
  string,
  {
    id: string
    hover: boolean
  }
>()

const hoverPaths$ = pathsState(
  (id: string) =>
    hoverChange$(id).pipe(
      scan((acc, v) => {
        if (v.hover) acc.add(v.id)
        else acc.delete(v.id)
        return acc
      }, new Set<string>()),
    ),
  new Set<string>(),
)

export const isActive$ = pathsState(
  (path: string, id: string) =>
    hoverPaths$(id).pipe(
      map((hoverPaths) => {
        if (!hoverPaths.has(path)) return false

        // Here it's the opposite of `isCollapsedRoot`: We don't want to highlight the root if a child is being highlighted
        return !Array.from(hoverPaths).some(
          (otherPath) => otherPath !== path && otherPath.startsWith(path),
        )
      }),
    ),
  false,
)
