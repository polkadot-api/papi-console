import { Blockchain } from "@acala-network/chopsticks-core"
import { getSyncProvider } from "@polkadot-api/json-rpc-provider-proxy"
import { blockHeader } from "@polkadot-api/substrate-bindings"
import { state } from "@react-rxjs/core"
import { JsonRpcProvider } from "polkadot-api/ws-provider/web"
import { BehaviorSubject, map } from "rxjs"

export const chopsticksInstance$ = new BehaviorSubject<Blockchain | null>(null)
export const isChopsticks$ = state(
  chopsticksInstance$.pipe(map((v) => !!v)),
  false,
)

export const createChopsticksProvider = (endpoint: string) =>
  withChopsticksEnhancer(
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
    }),
  )

/**
 * Chopsticks can create block number discontinuities on the chain, which breaks an assumption of polkadot-api.
 * The spec-compliant way of solving this is by emitting a stop event when that happens
 */
const withChopsticksEnhancer =
  (parent: JsonRpcProvider): JsonRpcProvider =>
  (onMessage) => {
    // if it's chopsticks, we can assume there's immediate finality, and there are no forks or reorgs
    let previousNumber: number | null = null
    let waitingForNumber: any = null
    const messageQueue: any[] = []

    const processMessage = (parsed: any) => {
      if (parsed.id?.startsWith("chopsticks-header-")) {
        const decodedHeader = blockHeader.dec(parsed.result)
        const currentNumber = decodedHeader.number

        if (
          waitingForNumber &&
          previousNumber !== null &&
          currentNumber > previousNumber + 1
        ) {
          onMessage(
            JSON.stringify({
              ...waitingForNumber,
              params: {
                ...waitingForNumber.params,
                result: {
                  event: "stop",
                },
              },
            }),
          )
          inner.send(
            JSON.stringify({
              jsonrpc: "2.0",
              id: "chopsticks-stopped",
              method: "chainHead_v1_unfollow",
              params: [waitingForNumber.params.subscription],
            }),
          )
          messageQueue.length = 0
          previousNumber = currentNumber
          waitingForNumber = null
          return
        }
        previousNumber = currentNumber

        if (waitingForNumber) {
          onMessage(JSON.stringify(waitingForNumber))
          waitingForNumber = null
        }

        if (messageQueue.length) {
          const [next] = messageQueue.splice(0, 1)
          processMessage(next)
        }
        return
      }

      if (waitingForNumber) {
        messageQueue.push(parsed)
        return
      }

      if (
        parsed.method === "chainHead_v1_followEvent" &&
        parsed.params?.result?.event === "newBlock"
      ) {
        const { blockHash } = parsed.params.result
        waitingForNumber = parsed

        inner.send(
          JSON.stringify({
            jsonrpc: "2.0",
            id: "chopsticks-header-" + blockHash,
            method: "chainHead_v1_header",
            params: [parsed.params.subscription, blockHash],
          }),
        )
        return
      }

      onMessage(JSON.stringify(parsed))
      if (messageQueue.length) {
        const [next] = messageQueue.splice(0, 1)
        processMessage(next)
      }
    }

    const inner = parent((msg) => {
      const parsed = JSON.parse(msg)

      processMessage(parsed)
    })

    return {
      send(message) {
        inner.send(message)
      },
      disconnect() {
        inner.disconnect()
      },
    }
  }
