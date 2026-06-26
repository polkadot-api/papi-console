import {
  forklift,
  Forklift,
  fromWorker,
  wsSource,
} from "@polkadot-api/forklift"
import Worker from "@polkadot-api/forklift/worker?worker"
import type { JsonRpcProvider } from "polkadot-api"
import { BehaviorSubject } from "rxjs"

export const forkliftInstance$ = new BehaviorSubject<Forklift | null>(null)

export const createForkliftProvider = (endpoint: string): JsonRpcProvider => {
  return (onMsg) => {
    const worker = new Worker()
    const instance = forklift(wsSource(endpoint), {
      mockSignatureHost: true,
      executor: fromWorker(worker),
    })
    forkliftInstance$.next(instance)
    const connection = instance.serve(onMsg)

    return {
      send: connection.send,
      disconnect() {
        forkliftInstance$.next(null)
        connection.disconnect()
        instance.destroy()
        worker.terminate()
      },
    }
  }
}
