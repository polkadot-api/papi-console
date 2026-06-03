import { CopyText } from "@/components/Copy"
import { shortStr } from "@/utils"
import { Codec, HexString } from "polkadot-api"
import { FC, ReactNode } from "react"

export const FieldGrid: FC<{
  fields: Array<{
    label: string
    value: ReactNode
  } | null>
}> = ({ fields }) => (
  <div className="grid gap-x-6 gap-y-1 md:grid-cols-2">
    {fields.map((field, idx) =>
      field ? <DigestDetailField key={idx} field={field} /> : null,
    )}
  </div>
)

export const FieldList: FC<{
  title: string
  values: Array<ReactNode>
}> = ({ title, values }) => (
  <div className="space-y-2  text-sm">
    <div className="text-xs font-medium uppercase tracking-wide">{title}</div>
    {values.length ? (
      <ol className="list-decimal space-y-1 pl-5">
        {values.map((value, i) => (
          <li key={i}>{value}</li>
        ))}
      </ol>
    ) : (
      <div className="text-foreground/50">(Empty)</div>
    )}
  </div>
)

export const DigestDetailField: FC<{
  field: { label: string; value: ReactNode }
}> = ({ field }) => (
  <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-baseline gap-2 text-sm">
    <span className="text-foreground/55">{field.label}</span>
    {field.value}
  </div>
)

export const HexDisplay: FC<{ value: HexString }> = ({ value }) => (
  <span className="flex items-center gap-1">
    <span className="truncate font-mono">{shortStr(value, 8)}</span>
    <CopyText className="shrink-0 text-foreground" text={value} binary={true} />
  </span>
)

export const createDecodeDigestFn =
  <T,>(codec: Codec<T>) =>
  (payload: HexString) => {
    try {
      return codec.dec(payload)
    } catch (ex) {
      console.error(ex)
      return null
    }
  }
