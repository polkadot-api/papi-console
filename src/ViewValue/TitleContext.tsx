import { createContext, FC, PropsWithChildren } from "react"

export const TitleContext = createContext<HTMLElement | null>(null)

export const ChildProvider: FC<
  PropsWithChildren<{ titleElement: HTMLElement | null }>
> = ({ titleElement, children }) => (
  <TitleContext.Provider value={titleElement}>{children}</TitleContext.Provider>
)
