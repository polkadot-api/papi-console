import {
  EditAccountId,
  EditBigNumber,
  EditBitSeq,
  EditBool,
  EditBytes,
  EditEthAccount,
  EditNumber,
  EditOption,
  EditPrimitiveComponentProps,
  EditResult,
  EditStr,
  EditVoid,
  NOTIN,
} from "@polkadot-api/react-builder"
import { u8 } from "@polkadot-api/substrate-bindings"
import { toHex } from "@polkadot-api/utils"
import { useStateObservable } from "@react-rxjs/core"
import { FC } from "react"
import { isActive$ } from "../common/paths.state"
import { useSubtreeFocus } from "../common/SubtreeFocus"
import { Circle } from "lucide-react"

export const CVoid: EditVoid = () => null

const CPrimitive: FC<EditPrimitiveComponentProps<any>> = ({
  encodedValue,
  path,
}) => {
  const isActive = useStateObservable(isActive$(path.join(".")))
  return encodedValue ? (
    <span className={highlight(isActive)}>
      <span className={headerHighlight(isActive)}>
        {toConcatHex(encodedValue)}
      </span>
    </span>
  ) : (
    <MissingData />
  )
}
export const CBool: EditBool = CPrimitive
export const CStr: EditStr = CPrimitive
export const CEthAccount: EditEthAccount = CPrimitive
export const CBigNumber: EditBigNumber = CPrimitive
export const CNumber: EditNumber = CPrimitive
export const CAccountId: EditAccountId = CPrimitive
export const CBytes: EditBytes = CPrimitive
export const CBitSeq: EditBitSeq = CPrimitive

export const COption: EditOption = ({ path, value, inner }) => {
  const isActive = useStateObservable(isActive$(path.join(".")))
  const focus = useSubtreeFocus()
  const sub = focus.getNextPath(path)
  if (sub) {
    return inner
  }
  if (value === NOTIN) return <MissingData />

  return (
    <span className={highlight(isActive)}>
      <span className={headerHighlight(isActive)}>
        {toConcatHex(u8.enc(value ? 1 : 0))}
      </span>
      {inner}
    </span>
  )
}

export const CResult: EditResult = ({ value, inner, path }) => {
  const isActive = useStateObservable(isActive$(path.join(".")))
  const focus = useSubtreeFocus()
  const sub = focus.getNextPath(path)
  if (sub) return inner

  if (value === NOTIN) return <MissingData />

  return (
    <span className={highlight(isActive)}>
      <span className={headerHighlight(isActive)}>
        {toConcatHex(u8.enc(value.success ? 0 : 1))}
      </span>
      {inner}
    </span>
  )
}

export const MissingData = () => (
  <span className="mx-0.5 text-foreground/30 text-sm whitespace-nowrap">
    [
    <Circle
      size={8}
      strokeWidth={3}
      className="text-red-500 inline-block mx-0.5"
    />
    ]
  </span>
)
export const toConcatHex = (value: Uint8Array) => toHex(value).slice(2)
export const highlight = (isActive: boolean) =>
  isActive ? "text-polkadot-400 mx-1" : ""
export const headerHighlight = (isActive: boolean) =>
  isActive ? "text-polkadot-500" : ""
