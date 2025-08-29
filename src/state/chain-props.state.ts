import { withDefault } from "@react-rxjs/core"
import { map, switchMap } from "rxjs"
import { client$ } from "./chains/chain.state"

export const chainProperties$ = client$.pipeState(
  switchMap((v) => v.getChainSpecData()),
  map((v) => v.properties),
  map(
    (
      v,
    ): {
      ss58Format?: number
      tokenDecimals?: number
      tokenSymbol?: string
    } => {
      if (v && typeof v === "object") {
        const { ss58Format, tokenDecimals, tokenSymbol } = v

        return {
          ss58Format,
          tokenDecimals,
          tokenSymbol,
        }
      }
      return {}
    },
  ),
  withDefault(null),
)
