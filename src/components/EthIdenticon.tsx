import { HexString } from "polkadot-api"
import { FC } from "react"
import { blo } from "blo"

export const EthIdenticon: FC<{ address: HexString; size?: number }> = ({
  address,
  size,
}) => {
  return <img className="rounded-full" src={blo(address as "0x", size)} />
}
