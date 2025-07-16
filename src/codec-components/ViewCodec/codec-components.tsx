import {
  ViewBigNumber,
  ViewBitSeq,
  ViewBool,
  ViewEthAccount,
  ViewNumber,
  ViewOption,
  ViewResult,
  ViewStr,
  ViewVoid,
} from "@polkadot-api/react-builder"

export const CBool: ViewBool = ({ value }) => {
  return <div className="flex gap-4">{value ? "Yes" : "No"}</div>
}

export const CVoid: ViewVoid = () => null

export const CEthAccount: ViewEthAccount = ({ value }) => <span>{value}</span>

export const COption: ViewOption = ({ value, inner }) => {
  const selected = value !== undefined
  return (
    <div>
      {selected ? inner : <span className="text-foreground/60">None</span>}
    </div>
  )
}

export const CResult: ViewResult = ({ value, inner }) => {
  return (
    <div>
      <div>{value.success ? "OK" : "KO"}</div>
      {inner}
    </div>
  )
}

export const CStr: ViewStr = ({ value }) => <div>{value}</div>
export const CNumber: ViewNumber = ({ value }) => <div>{value}</div>
export const CBitSeq: ViewBitSeq = ({ value }) => (
  <div>
    {value.map((val, idx) => `${val}${idx % 4 === 0 ? "_" : ""}`).join("")}
  </div>
)
export const CBigNumber: ViewBigNumber = ({ value }) => (
  <div>{String(value)}</div>
)
