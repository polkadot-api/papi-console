import { getHashParams } from "@/hashParams"
import { unsafeApi$ } from "@/state/chains/chain.state"
import {
  CodecComponentType,
  CodecComponentValue,
} from "@polkadot-api/react-builder"
import { state, withDefault } from "@react-rxjs/core"
import { createSignal } from "@react-rxjs/utils"
import { Binary } from "polkadot-api"
import { fromHex } from "polkadot-api/utils"
import { catchError, concat, defer, map, of, switchMap, take } from "rxjs"

export const [codecComponentChange$, setComponentValue] =
  createSignal<CodecComponentValue>()
export const codecComponentValue$ = state(
  defer(() => {
    const hashParamsData = getHashParams(location).get("data")
    const initial$ = hashParamsData
      ? of(hashParamsData)
      : unsafeApi$.pipe(
          take(1),
          switchMap((v) =>
            v.tx.System.remark({ remark: new Uint8Array() }).getEncodedData(),
          ),
          catchError(() => [new Uint8Array()]),
          map(Binary.toHex),
        )

    return concat(
      initial$.pipe(
        map(
          (value): CodecComponentValue => ({
            type: CodecComponentType.Initial,
            value,
          }),
        ),
      ),
      codecComponentChange$,
    )
  }),
)

export const getBinaryValue = (componentValue: CodecComponentValue) =>
  (componentValue.type === CodecComponentType.Initial
    ? typeof componentValue.value === "string"
      ? fromHex(componentValue.value)
      : componentValue.value
    : componentValue.value.empty
      ? null
      : componentValue.value.encoded) ?? null

export const callData$ = codecComponentValue$.pipeState(
  map(getBinaryValue),
  withDefault(null),
)
