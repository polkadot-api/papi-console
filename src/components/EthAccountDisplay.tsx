import { accountDetail$ } from "@/state/polkahub"
import { EthIdenticon } from "@polkadot-api/react-components"
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
    <div className={twMerge("flex items-center gap-2", className)}>
      <EthIdenticon address={value} size={28} />
      <div className="flex flex-col justify-center text-foreground leading-tight overflow-hidden">
        {name && <span className="inline-flex items-center gap-1">{name}</span>}
        <span className="text-foreground/50 text-ellipsis overflow-hidden">
          {value}
        </span>
      </div>
    </div>
  )
}
