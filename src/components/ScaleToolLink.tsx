import { Link } from "@/hashParams"
import { lookup$ } from "@/state/chains/chain.state"
import { lookupTypeToText } from "@/pages/ScaleTool/typeToText"
import { useStateObservable } from "@react-rxjs/core"
import { ComponentProps, FC } from "react"

export const ScaleToolLink: FC<
  Omit<ComponentProps<typeof Link>, "to"> & { typeId: number }
> = ({ typeId, ...props }) => {
  const lookup = useStateObservable(lookup$)
  let type: string
  try {
    type = lookupTypeToText(lookup.metadata.lookup, typeId)
  } catch (error) {
    const { children, className } = props
    return (
      <span
        className={className}
        aria-disabled="true"
        title={error instanceof Error ? error.message : String(error)}
      >
        {children}
      </span>
    )
  }
  const hash = `#${new URLSearchParams({ type }).toString()}`

  return <Link {...props} to={{ pathname: "/scale-tool", hash }} />
}
