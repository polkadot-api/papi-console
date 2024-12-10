import { accountDetail$ } from "@/state/extension-accounts.state"
import { useStateObservable } from "@react-rxjs/core"
import { HexString } from "polkadot-api"
import { FC } from "react"
import { twMerge } from "tailwind-merge"

export const EthAccountDisplay: FC<{
  value: HexString
  className?: string
}> = ({ value, className }) => {
  const { name } = useStateObservable(accountDetail$(value)) ?? {}
  return (
    <div
      className={twMerge(
        "flex flex-col justify-center text-foreground leading-tight overflow-hidden",
        className,
      )}
    >
      {name && <span className="inline-flex items-center gap-1">{name}</span>}
      <span className="text-foreground/50 text-ellipsis overflow-hidden">
        {value}
      </span>
    </div>
  )
}
