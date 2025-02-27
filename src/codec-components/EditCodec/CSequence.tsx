import { EditSequence, NOTIN } from "@polkadot-api/react-builder"
import { CirclePlus } from "lucide-react"
import { twMerge as clsx } from "tailwind-merge"
import { ListItem } from "../common/ListItem"
import { useSubtreeFocus } from "../common/SubtreeFocus"

export const CSequence: EditSequence = ({
  innerComponents,
  value,
  onValueChanged,
  path,
}) => {
  const focus = useSubtreeFocus()
  const sub = focus.getNextPath(path)
  if (sub) {
    return innerComponents[Number(sub)]
  }

  const addItem = () => {
    const curr = value !== NOTIN ? value.slice() : []

    curr.push(NOTIN)
    onValueChanged([...curr])
  }

  const removeItem = (idx: number) => {
    const curr = value !== NOTIN ? value.slice() : []
    curr.splice(idx, 1)
    onValueChanged([...curr])
  }

  return (
    <div>
      <ul>
        {innerComponents.map((item, idx) => (
          <ListItem
            key={idx}
            idx={idx}
            onDelete={() => {
              removeItem(idx)
            }}
            path={[...path, String(idx)]}
          >
            {item}
          </ListItem>
        ))}
      </ul>
      <button
        className={clsx(
          "flex flex-row gap-2 border rounded-full py-1 pl-3 pr-1 mt-3 border-slate-500 text-slate-500",
          "hover:border-polkadot-500 hover:text-polkadot-500 hover:cursor-pointer",
        )}
        onClick={addItem}
      >
        add item <CirclePlus strokeWidth="1" />
      </button>
    </div>
  )
}
