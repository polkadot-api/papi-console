import {
  IdentityData,
  IdentityJudgement,
  polkadot_people,
} from "@polkadot-api/descriptors"
import { state } from "@react-rxjs/core"
import { Binary, createClient, SS58String } from "polkadot-api"
import { chainSpec } from "./chainspecs/polkadot_people"
import { catchError, map, of, tap } from "rxjs"
import { getProvider } from "./chain.state"
import { localStorageSubject } from "./utils/localStorageSubject"

export interface Identity {
  displayName: string
  judgments: Array<{
    registrar: number
    judgement: IdentityJudgement["type"]
  }>
}
export const isVerified = (identity: Identity | null) =>
  identity?.judgments.some((j) => j.judgement === "Reasonable")

const cache = localStorageSubject<Record<string, Identity>>(
  "identity-cache",
  JSON,
  {},
)

// const client = createClient(
//   getProvider({
//     id: "polkadot_people",
//     type: "chainSpec",
//     value: {
//       chainSpec,
//       relayChain: "polkadot",
//     },
//   }),
// )
// const typedApi = client.getTypedApi(polkadot_people)

export const identity$ = state(
  (address: SS58String) => of(null),
  // typedApi.query.Identity.IdentityOf.watchValue(address).pipe(
  //   map((res): Identity | null => {
  //     const displayName = res && readIdentityData(res[0].info.display)
  //     return displayName
  //       ? {
  //           displayName: displayName.asText(),
  //           judgments: res[0].judgements.map(([registrar, judgement]) => ({
  //             registrar,
  //             judgement: judgement.type,
  //           })),
  //         }
  //       : null
  //   }),
  //   tap((v) =>
  //     cache.setValue((c) => {
  //       if (v) {
  //         return { ...c, [address]: v }
  //       } else {
  //         delete c[address]
  //         return c
  //       }
  //     }),
  //   ),
  //   catchError(() => of(null)),
  // ),
  (address) => cache.getValue()[address] ?? null,
)

const readIdentityData = (identityData: IdentityData): Binary | null => {
  if (identityData.type === "None" || identityData.type === "Raw0") return null
  if (identityData.type === "Raw1")
    return Binary.fromBytes(new Uint8Array(identityData.value))
  return identityData.value
}
