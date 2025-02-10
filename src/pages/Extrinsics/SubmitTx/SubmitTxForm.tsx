import { ActionButton } from "@/components/ActionButton"
import { Spinner } from "@/components/Icons"
import { trackSignedTx, trackUnsignedTx } from "@/pages/Transactions"
import { unsafeApi$ } from "@/state/chains/chain.state"
import { compactNumber } from "@polkadot-api/substrate-bindings"
import { fromHex, mergeUint8, toHex } from "@polkadot-api/utils"
import { useStateObservable } from "@react-rxjs/core"
import { Binary } from "polkadot-api"
import { FC, useState } from "react"
import { firstValueFrom } from "rxjs"
import { twMerge } from "tailwind-merge"
import { AccountProvider, selectedAccount$ } from "./AccountProvider"
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
        setIsSigning(true)
        try {
          const unsafeApi = await firstValueFrom(unsafeApi$)
          const tx = await unsafeApi.txFromCallData(Binary.fromHex(callData))
          const signedExtrinsic = await tx.sign(account!.polkadotSigner)
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
        const unsignedTx = mergeUint8(
          compactNumber.enc(data.length + 1),
          new Uint8Array([4]),
          data,
        )
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
      <AccountProvider />
      <div className="flex flex-col gap-2">
        <SignAndSubmit {...props} />
        <SubmitUnsigned {...props} />
      </div>
    </>
  )
}
