import { TAssetInfo, TXcmFeeBase } from "@paraspell/sdk"
import { useStateObservable } from "@react-rxjs/core"
import { FC } from "react"
import { switchMap } from "rxjs"
import { paraspellBuilder$ } from "./Setup"

export const routeInfo$ = paraspellBuilder$.pipeState(
  switchMap((builder) => (builder ? builder.getTransferInfo() : [null])),
)

export const RoutePreview = () => {
  const builder = useStateObservable(paraspellBuilder$)
  const routeInfo = useStateObservable(routeInfo$)

  if (!builder) return <div>Fill in everything please</div>
  if (!routeInfo) return <div>Loading…</div>

  return (
    <div>
      <div>
        <div>Origin</div>
        <div>{routeInfo.chain.ecosystem}</div>
        <div>{routeInfo.chain.origin}</div>
        <XcmFee fee={routeInfo.origin.xcmFee} />
        <div>Balance: {routeInfo.origin.xcmFee.balance}</div>
        <div>Balance After: {routeInfo.origin.xcmFee.balanceAfter}</div>
      </div>
      {routeInfo.hops.map((hop, i) => (
        <div key={i}>
          <div>Hop</div>
          <div>{hop.chain}</div>
          <XcmFee fee={hop.result.xcmFee} />
          <AssetDisplay asset={hop.result.asset} />
        </div>
      ))}
      <div>
        <div>Destination</div>
        <div>{routeInfo.chain.destination}</div>
        <XcmFee fee={routeInfo.destination.xcmFee} />
        <div>
          Received:{" "}
          {routeInfo.destination.receivedCurrency.receivedAmount?.toString()}
        </div>
        <div>Balance: {routeInfo.destination.receivedCurrency.balance}</div>
        <div>
          Balance After:{" "}
          {routeInfo.destination.receivedCurrency.balanceAfter?.toString()}
        </div>
      </div>
    </div>
  )
}

const XcmFee: FC<{
  fee: TXcmFeeBase
}> = ({ fee }) => (
  <div className="flex items-center gap-1">
    <div>XCM Fee: {fee.fee}</div>
    m<AssetDisplay asset={fee.asset} />
  </div>
)

const AssetDisplay: FC<{ asset: TAssetInfo }> = ({ asset }) => (
  <div>
    <div>{asset.symbol}</div>
  </div>
)
