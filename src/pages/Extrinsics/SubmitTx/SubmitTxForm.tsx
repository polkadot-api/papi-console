import { ActionButton } from "@/components/ActionButton"
import { Spinner } from "@/components/Icons"
import { cn } from "@/lib/utils"
import { trackSignedTx, trackUnsignedTx } from "@/pages/Transactions"
import { unsafeApi$ } from "@/state/chains/chain.state"
import { selectedAccount$ } from "@/state/polkahub"
import { compactNumber } from "@polkadot-api/substrate-bindings"
import { fromHex, mergeUint8, toHex } from "@polkadot-api/utils"
import { AccountPicker } from "@polkahub/ui-components"
import { useStateObservable } from "@react-rxjs/core"
import { Binary } from "polkadot-api"
import {
  AddressIdentity,
  useAvailableAccounts,
  useSelectedAccount,
} from "polkahub"
import { FC, useState } from "react"
import { combineLatest, firstValueFrom } from "rxjs"
import { twMerge } from "tailwind-merge"
import { customSignedExtensions$ } from "../CustomSignedExt"
import { ExtensionProvider } from "./ExtensionProvider"

const SignAndSubmit: FC<{ callData: string; onClose: () => void }> = ({
  callData,
  onClose,
}) => {
  const account = useStateObservable(selectedAccount$)
  const [isSigning, setIsSigning] = useState(false)

  return (
    <ActionButton
      onClick={async () => {
        if (!account?.signer) return

        setIsSigning(true)
        try {
          const [unsafeApi, signedExt] = await firstValueFrom(
            combineLatest([unsafeApi$, customSignedExtensions$]),
          )
          const tx = await unsafeApi.txFromCallData(Binary.fromHex(callData))
          const signedExtrinsic = await tx.sign(account.signer, {
            customSignedExtensions: signedExt as any,
          })
          trackSignedTx(signedExtrinsic)
          onClose()
        } catch (ex) {
          console.error(ex)
        }
        setIsSigning(false)
      }}
      className="flex gap-2 items-center justify-center"
      disabled={!account}
    >
      <span className={twMerge("ml-6", isSigning ? "" : "mr-6")}>
        Sign and Submit
      </span>
      {isSigning && <Spinner size={16} />}
    </ActionButton>
  )
}

const SubmitUnsigned: FC<{ callData: string; onClose: () => void }> = ({
  callData,
  onClose,
}) => {
  return (
    <ActionButton
      onClick={() => {
        const data = fromHex(callData)
        const unsignedTx = mergeUint8([
          compactNumber.enc(data.length + 1),
          new Uint8Array([4]),
          data,
        ])
        trackUnsignedTx(toHex(unsignedTx))
        onClose()
      }}
      className="flex gap-2 items-center justify-center"
    >
      Submit without signing
    </ActionButton>
  )
}

export default function SubmitTxF(props: {
  callData: string
  onClose: () => void
}) {
  return (
    <>
      <ExtensionProvider />
      <SelectAccount />
      <div className="flex flex-col gap-2">
        <SignAndSubmit {...props} />
        <SubmitUnsigned {...props} />
      </div>
    </>
  )
}

const groupLabels: Record<string, string> = {
  ledger: "Ledger",
  readonly: "Read Only",
  "polkadot-vault": "Vault",
  walletconnect: "Wallet Connect",
}

const SelectAccount: FC<{
  className?: string
}> = ({ className }) => {
  const availableAccounts = useAvailableAccounts()
  const [account, setAccount] = useSelectedAccount()

  const groups = Object.entries(availableAccounts)
    .map(
      ([group, accounts]) =>
        [group, accounts.filter((acc) => acc.signer)] as const,
    )
    .filter(([, accounts]) => accounts.length > 0)
    .map(([key, accounts]) => ({
      name: groupLabels[key] ?? key,
      accounts,
    }))

  if (!groups.length && !account) return null

  return (
    <AccountPicker
      value={account}
      onChange={setAccount}
      groups={groups}
      className={cn(className, "max-w-auto w-full")}
      renderAddress={(account) => (
        <AddressIdentity
          addr={account.address}
          name={account?.name}
          copyable={false}
        />
      )}
      disableClear
    />
  )
}
