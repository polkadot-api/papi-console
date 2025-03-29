import { state, useStateObservable } from "@react-rxjs/core"
import {
  createContext,
  FC,
  PropsWithChildren,
  useContext,
  useLayoutEffect,
} from "react"
import { fromEvent, map } from "rxjs"

const getCurrentMedia = (): "light" | "dark" =>
  window.matchMedia
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light"
    : "dark"

const defaultTheme = getCurrentMedia()

const ThemeContext = createContext<"light" | "dark">(defaultTheme)

export const useTheme = () => useContext(ThemeContext)

const theme$ = state(
  fromEvent<MediaQueryListEvent>(
    window.matchMedia("(prefers-color-scheme: dark)"),
    "change",
  ).pipe(map((evt) => (evt.matches ? "dark" : "light"))),
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
