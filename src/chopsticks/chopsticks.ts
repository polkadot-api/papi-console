import { Blockchain } from "@acala-network/chopsticks-core"
import { getSyncProvider } from "@polkadot-api/json-rpc-provider-proxy"
import { BehaviorSubject } from "rxjs"

export const chopsticksInstance$ = new BehaviorSubject<Blockchain | null>(null)

export const createChopsticksProvider = (endpoint: string) =>
  getSyncProvider(async () => {
    const { ChopsticksProvider, setup } = await import(
      "@acala-network/chopsticks-core"
    )

    chopsticksInstance$.getValue()?.close()
    const chain = await setup({
      endpoint,
      mockSignatureHost: true,
    })
    chopsticksInstance$.next(chain)

    const innerProvider = new ChopsticksProvider(chain)
    return (onMessage) => {
      return {
        send: async (message: string) => {
          const parsed = JSON.parse(message)

          if (parsed.method === "chainHead_v1_follow") {
            const subscription = await innerProvider.subscribe(
              "chainHead_v1_followEvent",
              parsed.method,
              parsed.params,
              (err, result) => {
                if (err) {
                  console.error(err)
                  return
                }
                onMessage(
                  JSON.stringify({
                    jsonrpc: "2.0",
                    method: "chainHead_v1_followEvent",
                    params: {
                      subscription,
                      result,
                    },
                  }),
                )
              },
            )
            onMessage(
              JSON.stringify({
                jsonrpc: "2.0",
                id: parsed.id,
                result: subscription,
              }),
            )
            return
          }

          const response = await innerProvider.send(
            parsed.method,
            parsed.params,
          )
          onMessage(
            JSON.stringify({
              jsonrpc: "2.0",
              id: parsed.id,
              result: response,
            }),
          )
        },
        disconnect: () => {
          chain?.close()
          chopsticksInstance$.next(null)
        },
      }
    }
  })
