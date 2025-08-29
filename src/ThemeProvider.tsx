import { state, useStateObservable } from "@react-rxjs/core"
import { createSignal } from "@react-rxjs/utils"
import {
  createContext,
  FC,
  PropsWithChildren,
  useContext,
  useLayoutEffect,
} from "react"
import { fromEvent, map, merge } from "rxjs"

export const [changeTheme$, changeTheme] = createSignal<"light" | "dark">()

const getCurrentMedia = (): "light" | "dark" =>
  window.matchMedia
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light"
    : "dark"

const prefLSKey = "theme"
changeTheme$.subscribe((theme) => {
  if (getCurrentMedia() === theme) {
    localStorage.removeItem(prefLSKey)
  } else {
    localStorage.setItem(prefLSKey, theme)
  }
})

const defaultTheme =
  (localStorage.getItem(prefLSKey) as "light" | "dark") || getCurrentMedia()

const ThemeContext = createContext<"light" | "dark">(defaultTheme)

export const useTheme = () => useContext(ThemeContext)

const theme$ = state(
  merge(
    fromEvent<MediaQueryListEvent>(
      window.matchMedia("(prefers-color-scheme: dark)"),
      "change",
    ).pipe(map((evt) => (evt.matches ? "dark" : "light"))),
    changeTheme$,
  ),
  defaultTheme,
)

export const ThemeProvider: FC<PropsWithChildren> = ({ children }) => {
  const theme = useStateObservable(theme$)

  useLayoutEffect(() => {
    if (theme === "dark") {
      document.body.classList.add("dark")
    } else {
      document.body.classList.remove("dark")
    }
  }, [theme])

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
}
