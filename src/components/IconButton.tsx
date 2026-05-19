import { Button } from "@polkahub/ui-components"
import { BookmarkPlus } from "lucide-react"
import { ButtonHTMLAttributes, ComponentProps, FC, ReactNode } from "react"
import { Link } from "@/hashParams"
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip"
import { twMerge } from "tailwind-merge"
import { actionButtonClassName } from "./ActionButton"

export const IconButton: FC<
  ComponentProps<typeof Button> & {
    tooltip: ReactNode
  }
> = ({ tooltip, ...props }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button variant="ghost" size="icon" {...props} />
    </TooltipTrigger>
    <TooltipContent>{tooltip}</TooltipContent>
  </Tooltip>
)

export const IconLink: FC<
  ComponentProps<typeof Link> & {
    tooltip: ReactNode
  }
> = ({ tooltip, ...props }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Link {...props} />
    </TooltipTrigger>
    <TooltipContent>{tooltip}</TooltipContent>
  </Tooltip>
)

export const IconActionButton: FC<
  ButtonHTMLAttributes<any> & {
    tooltip: ReactNode
  }
> = ({ tooltip, ...props }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        {...props}
        className={twMerge(actionButtonClassName(), props.className)}
      />
    </TooltipTrigger>
    <TooltipContent>{tooltip}</TooltipContent>
  </Tooltip>
)

export const AddToWorkspace: FC<ComponentProps<typeof Button>> = (props) => (
  <IconButton {...props} tooltip="Save to workspace">
    <BookmarkPlus />
  </IconButton>
)
