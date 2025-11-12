import { FC, PropsWithChildren } from "react"
import { ChildProvider } from "./TitleContext"
import { ViewValue } from "./ViewValue"

export const ArrayDisplay: FC<{ value: unknown[] }> = ({ value }) => (
  <ul className="w-full">
    {value.length ? (
      value.map((innerValue, idx) => (
        <ListItemComponent key={idx} idx={idx}>
          <ViewValue value={innerValue} />
        </ListItemComponent>
      ))
    ) : (
      <span className="text-sm text-foreground/60">(Empty)</span>
    )}
  </ul>
)

const ListItemComponent: FC<
  PropsWithChildren<{
    idx: number
  }>
> = ({ idx, children }) => {
  return (
    <ChildProvider titleElement={null}>
      <ListItem idx={idx}>{children}</ListItem>
    </ChildProvider>
  )
}

const ListItem: React.FC<
  PropsWithChildren<{
    idx: number
  }>
> = ({ idx, children }) => {
  const title = (
    <div className="flex items-center">
      <span className="cursor-pointer flex items-center py-1 gap-1">
        Item {idx + 1}.
      </span>
    </div>
  )

  return (
    <li className={"flex flex-col mb-1"}>
      {title}
      <div className={"flex-row p-2 items-center border border-border"}>
        {children}
      </div>
    </li>
  )
}
