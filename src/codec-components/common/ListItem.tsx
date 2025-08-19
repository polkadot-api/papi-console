import { ExpandBtn } from "@/components/Expand"
import { useStateObservable } from "@react-rxjs/core"
import { Dot, Trash2, Copy } from "lucide-react"
import { ReactNode, useContext } from "react"
import { twMerge as clsx, twMerge } from "tailwind-merge"
import { Marker } from "./Markers"
import {
  isActive$,
  isCollapsed$,
  PathsRoot,
  setHovered,
  toggleCollapsed,
} from "./paths.state"

export const ListItem: React.FC<{
  idx: number
  children: React.ReactNode
  path: string[]
  onDelete?: () => void
  onDuplicate?: () => void
  actions?: ReactNode
  inline?: boolean
}> = ({ idx, onDelete, onDuplicate, children, path, actions, inline }) => {
  const pathsRootId = useContext(PathsRoot)
  const pathStr = path.join(".")
  const isActive = useStateObservable(isActive$(pathStr))
  const isCollapsed = useStateObservable(isCollapsed$(pathStr))

  const title = inline ? (
    <div className="flex items-center">
      <Marker id={path} />
      <span className="flex items-center py-1 gap-1 mr-2">
        <Dot size={16} />
        Item {idx + 1}.
      </span>
      <div className="flex-1">{children}</div>
      {onDuplicate && (
        <button
          className="cursor-pointer text-foreground/80 ml-2 hover:text-primary"
          onClick={onDuplicate}
          title="Duplicate item"
        >
          <Copy size={16} />
        </button>
      )}
      {onDelete && (
        <button
          className="cursor-pointer text-foreground/80 ml-2 hover:text-primary"
          onClick={onDelete}
        >
          <Trash2 size={16} />
        </button>
      )}
      {actions}
    </div>
  ) : (
      <div className="flex items-center">
        <Marker id={path} />
        <span
          className="cursor-pointer flex items-center py-1 gap-1"
          onClick={() => toggleCollapsed(pathsRootId, pathStr)}
        >
          <ExpandBtn expanded={!isCollapsed} />
          Item {idx + 1}.
        </span>
        {onDuplicate && (
          <button
            className="cursor-pointer text-foreground/80 ml-2 hover:text-primary"
            onClick={onDuplicate}
            title="Duplicate item"
          >
            <Copy size={16} />
          </button>
        )}
        {onDelete && (
          <button
            className="cursor-pointer text-foreground/80 ml-2 hover:text-primary"
            onClick={onDelete}
          >
            <Trash2 size={16} />
          </button>
        )}
        {actions}
      </div>
    )

  return (
    <li
      className={twMerge("flex flex-col mb-1", isActive && "bg-secondary/80")}
      onMouseEnter={() => setHovered(pathsRootId, { id: pathStr, hover: true })}
      onMouseLeave={() =>
        setHovered(pathsRootId, { id: pathStr, hover: false })
      }
    >
      {title}
      {inline ? null : (
        <div
          className={clsx(
            "flex-row p-2 items-center border border-border",
            isCollapsed ? "hidden" : "",
          )}
        >
          {children}
        </div>
      )}
    </li>
  )
}
