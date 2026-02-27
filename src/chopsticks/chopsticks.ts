import type {
  Blockchain,
  ChopsticksProvider,
} from "@acala-network/chopsticks-core"
import {
  getSyncProvider,
  InnerJsonRpcProvider,
} from "@polkadot-api/json-rpc-provider-proxy"
import { blockHeader } from "@polkadot-api/substrate-bindings"
import type { JsonRpcProvider } from "polkadot-api"
import { BehaviorSubject } from "rxjs"

export const chopsticksInstance$ = new BehaviorSubject<Blockchain | null>(null)

export const createChopsticksProvider = (endpoint: string) =>
  withChopsticksEnhancer(
    getSyncProvider((onReady) => {
      let isRunning = true
      let chain: Blockchain

      let innerProvider: InstanceType<typeof ChopsticksProvider>
      const provider: InnerJsonRpcProvider = (onMessage) => {
        return {
          send: async (msg) => {
            if (msg.method === "chainHead_v1_follow") {
              const subscription = await innerProvider.subscribe(
                "chainHead_v1_followEvent",
                msg.method,
                msg.params,
                (err, result) => {
                  if (err) {
                    console.error(err)
                    return
                  }
                  onMessage({
                    jsonrpc: "2.0",
                    method: "chainHead_v1_followEvent",
                    params: {
                      subscription,
                      result,
                    },
                  })
                },
              )
              onMessage({
                jsonrpc: "2.0",
                id: msg.id!,
                result: subscription,
              })
              return
            }

            const response = await innerProvider.send(msg.method, msg.params)
            onMessage({
              jsonrpc: "2.0",
              id: msg.id!,
              result: response,
            })
          },
          disconnect: () => {
            chain.close()
            chopsticksInstance$.next(null)
          },
        }
      }
      ;(async () => {
        try {
          const { ChopsticksProvider, setup } =
            await import("@acala-network/chopsticks-core")

          chain = await setup({
            endpoint,
            mockSignatureHost: true,
          })
          innerProvider = new ChopsticksProvider(chain)
          if (isRunning) {
            onReady(provider)
            chopsticksInstance$.next(chain)
          } else chain.close()
        } catch {
          if (isRunning) onReady(null)
        }
      })()
      return () => {
        isRunning = false
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
          onMessage({
            ...waitingForNumber,
            params: {
              ...waitingForNumber.params,
              result: {
                event: "stop",
              },
            },
          })
          inner.send({
            jsonrpc: "2.0",
            id: "chopsticks-stopped",
            method: "chainHead_v1_unfollow",
            params: [waitingForNumber.params.subscription],
          })
          messageQueue.length = 0
          previousNumber = currentNumber
          waitingForNumber = null
          return
        }
        previousNumber = currentNumber

        if (waitingForNumber) {
          onMessage(waitingForNumber)
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

        inner.send({
          jsonrpc: "2.0",
          id: "chopsticks-header-" + blockHash,
          method: "chainHead_v1_header",
          params: [parsed.params.subscription, blockHash],
        })
        return
      }

      onMessage(parsed)
      if (messageQueue.length) {
        const [next] = messageQueue.splice(0, 1)
        processMessage(next)
      }
    }

    const inner = parent(processMessage)

    return {
      send(message) {
        inner.send(message)
      },
      disconnect() {
        inner.disconnect()
      },
    }
  }
