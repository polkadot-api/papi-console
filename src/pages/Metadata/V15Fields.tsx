import { CopyText } from "@/components/Copy"
import { UnifiedMetadata } from "@polkadot-api/substrate-bindings"
import { FC } from "react"
import { LookupLink } from "./Lookup"

export const OuterEnums: FC<{
  outerEnums: UnifiedMetadata<15 | 16>["outerEnums"]
}> = ({ outerEnums }) => (
  <div className="border rounded p-2 flex flex-col gap-2">
    <div>
      <h4>Call</h4>
      <LookupLink id={outerEnums.call} />
    </div>
    <div>
      <h4>Event</h4>
      <LookupLink id={outerEnums.event} />
    </div>
    <div>
      <h4>Error</h4>
      <LookupLink id={outerEnums.error} />
    </div>
  </div>
)

export const Custom: FC<{ custom: UnifiedMetadata<15 | 16>["custom"] }> = ({
  custom,
}) => (
  <div className="border rounded p-2 flex flex-col gap-2">
    {Object.entries(
      custom.map(([key, { type, value }]) => (
        <div key={key}>
          <h4>{key}</h4>
          <LookupLink id={type} />
          <div className="whitespace-nowrap overflow-hidden text-ellipsis">
            <CopyText text={value} binary className="mr-2" />
            {value}
          </div>
        </div>
      )),
    )}
  </div>
)
