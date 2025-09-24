import { ComponentType, FC } from "react"
import { BlockState } from "../block.state"
import {
  CircleAlert,
  CircleCheck,
  CircleQuestionMark,
  CircleX,
  Clock,
  LucideProps,
} from "lucide-react"
import { twMerge } from "tailwind-merge"

const statusIcon: Record<BlockState, ComponentType<LucideProps>> = {
  [BlockState.Best]: Clock,
  [BlockState.Fork]: CircleAlert,
  [BlockState.Finalized]: CircleCheck,
  [BlockState.Pruned]: CircleX,
  [BlockState.Unknown]: CircleQuestionMark,
}
const statusClassName: Record<BlockState, string> = {
  [BlockState.Best]: "text-blue-400",
  [BlockState.Fork]: "text-orange-400",
  [BlockState.Finalized]: "text-green-400",
  [BlockState.Pruned]: "text-red-400",
  [BlockState.Unknown]: "text-orange-400",
}

export const BlockStatusIcon: FC<
  {
    state: BlockState
  } & LucideProps
> = ({ state, className, ...props }) => {
  const Icon = statusIcon[state]

  return (
    <Icon {...props} className={twMerge(statusClassName[state], className)} />
  )
}
export const statusText: Record<BlockState, string> = {
  [BlockState.Best]: "Pending",
  [BlockState.Fork]: "Fork",
  [BlockState.Finalized]: "Finalized",
  [BlockState.Pruned]: "Pruned",
  [BlockState.Unknown]: "Unknown",
}
