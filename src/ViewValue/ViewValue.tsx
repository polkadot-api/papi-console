import { BytesDisplay } from "@/codec-components/ViewCodec/CBytes"
import { AccountIdDisplay } from "@/components/AccountIdDisplay"
import { Binary, getSs58AddressInfo } from "polkadot-api"
import { FC } from "react"
import { EnumDisplay } from "./EnumDisplay"
import { ArrayDisplay } from "./ListComponents"
import { StructDisplay } from "./StructDisplay"
import {
  BoolDisplay,
  EthAccountDisplay,
  NoneDisplay,
  NumberDisplay,
  ResultDisplay,
  StrDisplay,
} from "./view-components"

export const ViewValue: FC<{
  value: unknown
}> = ({ value }) => {
  switch (typeof value) {
    case "string": {
      const info = getSs58AddressInfo(value)
      if (info.isValid) return <AccountIdDisplay value={value} />
      if (value.startsWith("0x") && value.length === 42)
        return <EthAccountDisplay value={value} />
      return <StrDisplay value={value} />
    }
    case "boolean":
      return <BoolDisplay value={value} />
    case "number":
    case "bigint":
      return <NumberDisplay value={value} />
    case "object": {
      if (value == null) return <>TODO</>
      if (value instanceof Binary) return <BytesDisplay value={value} />
      if (Array.isArray(value)) return <ArrayDisplay value={value} />
      if ("type" in value && typeof value.type === "string" && "value" in value)
        return <EnumDisplay value={value as any} />
      if (
        "success" in value &&
        typeof value.success === "boolean" &&
        "value" in value
      )
        return <ResultDisplay value={value as any} />
      return <StructDisplay value={value as any} />
    }
    case "undefined":
      return <NoneDisplay />
  }
  return <div className="text-muted-foreground">(Uknown value)</div>
}
