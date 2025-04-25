import { PolkadotIdenticon } from "@/components/PolkadotIdenticon"
import { accountDetail$, getPublicKey } from "@/state/extension-accounts.state"
import { identity$, isVerified } from "@/state/identity.state"
import { useStateObservable } from "@react-rxjs/core"
import { CheckCircle } from "lucide-react"
import { SS58String } from "polkadot-api"
import { FC } from "react"
import { twMerge } from "tailwind-merge"

export const AccountIdDisplay: FC<{
  value: SS58String
  className?: string
}> = ({ value, className }) => {
  const details = useStateObservable(accountDetail$(value))
  const identity = useStateObservable(identity$(value))

  const name = identity?.displayName ?? details?.name

  return (
    <div className={twMerge("flex items-center gap-2", className)}>
      <PolkadotIdenticon
        className="shrink-0"
        publicKey={getPublicKey(value)}
        size={28}
      />
      <div className="flex flex-col justify-center text-foreground leading-tight overflow-hidden">
        {name && (
          <span className="inline-flex items-center gap-1">
            {name}
            {isVerified(identity) && (
              <CheckCircle
                size={16}
                className="text-green-500 dark:text-green-400"
              />
            )}
          </span>
        )}
        <span className="text-foreground/50 text-ellipsis overflow-hidden">
          {value}
        </span>
      </div>
    </div>
  )
}
