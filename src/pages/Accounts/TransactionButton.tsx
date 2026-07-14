import { Button } from "@/components/ui/button"
import { Link } from "@/hashParams"
import { ExternalLink, LockKeyhole } from "lucide-react"
import { Transaction } from "polkadot-api"
import { toHex } from "polkadot-api/utils"
import { useAvailableAccounts, useSelectedAccount } from "polkahub"
import { FC, useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { trackTx } from "../Extrinsics/ExtrinsicsWorkspaceEntry"

export const TransactionButton: FC<{
  tx: Transaction
}> = ({ tx }) => {
  const { accountId } = useParams()
  const [selectedAccount] = useSelectedAccount()
  const allAccounts = useAvailableAccounts()
  const [callData, setCallData] = useState({
    tx,
    value: "",
  })
  const loadedCallData = callData.tx === tx ? callData.value : ""
  const account =
    selectedAccount?.address === accountId
      ? selectedAccount
      : Object.values(allAccounts)
          .flat()
          .find((v) => v.signer && v.address === accountId)

  useEffect(() => {
    let cancelled = false
    tx.getEncodedData().then(
      (value) => {
        if (cancelled) return
        setCallData({ tx, value: toHex(value) })
      },
      (ex) => {
        console.error(ex)
      },
    )
    return () => {
      cancelled = true
    }
  }, [tx])

  const submit = async () => {
    if (!account?.signer) return
    const signed = await tx.sign(account.signer)
    trackTx(signed, tx.decodedCall, account)
  }

  return (
    <div className="flex min-w-48 flex-col gap-2">
      <Button
        type="button"
        disabled={!account?.signer}
        onClick={submit}
        className="h-9 justify-center gap-2"
      >
        <LockKeyhole className="h-4 w-4" />
        Sign and submit
      </Button>
      <Button
        type="button"
        variant="secondary"
        disabled={!loadedCallData}
        asChild={!!loadedCallData}
        className="h-9 justify-center gap-2"
      >
        {loadedCallData ? (
          <Link to={`/extrinsics#data=${loadedCallData}`}>
            <ExternalLink className="h-4 w-4" />
            Open in extrinsics
          </Link>
        ) : (
          <>
            <ExternalLink className="h-4 w-4" />
            Open in extrinsics
          </>
        )}
      </Button>
    </div>
  )
}
