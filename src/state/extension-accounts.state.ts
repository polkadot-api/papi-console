import { state, withDefault } from "@react-rxjs/core"
import { combineKeys, createKeyedSignal } from "@react-rxjs/utils"
import { Binary, getSs58AddressInfo } from "polkadot-api"
import {
  connectInjectedExtension,
  getInjectedExtensions,
  InjectedExtension,
  InjectedPolkadotAccount,
} from "polkadot-api/pjs-signer"
import {
  catchError,
  concat,
  defer,
  filter,
  interval,
  map,
  NEVER,
  Observable,
  of,
  retry,
  scan,
  startWith,
  switchMap,
  take,
  tap,
  timer,
} from "rxjs"

export const availableExtensions$ = state(
  concat(
    timer(0, 100).pipe(
      map(getInjectedExtensions),
      filter((v) => v.length > 0),
      take(1),
    ),
    interval(2000).pipe(map(getInjectedExtensions)),
  ),
  [],
)

const [toggleExtension$, onToggleExtension] = createKeyedSignal<string>()
export { onToggleExtension }

export const enum ConnectStatus {
  Connecting,
  Disconnected,
  Connected,
}
export type ExtensionState =
  | {
      type: ConnectStatus.Disconnected
    }
  | { type: ConnectStatus.Connecting }
  | { type: ConnectStatus.Connected; value: InjectedExtension }

const SELECTED_EXTENSIONS_KEY = "selected-extensions"
const getPreselectedExtensions = () => {
  try {
    const res = JSON.parse(localStorage.getItem(SELECTED_EXTENSIONS_KEY)!)
    if (Array.isArray(res)) return res
    // eslint-disable-next-line no-empty
  } catch (_) {}
  return null
}
const extensionIsPreselected = (extension: string) =>
  getPreselectedExtensions()?.includes(extension) ?? false
const setPreselectedExtension = (extension: string, selected: boolean) => {
  const preselectedExtensions = getPreselectedExtensions() ?? []
  const result = selected
    ? [...new Set([...preselectedExtensions, extension])]
    : preselectedExtensions.filter((v) => v !== extension)
  localStorage.setItem(SELECTED_EXTENSIONS_KEY, JSON.stringify(result))
}

const extension$ = (name: string) => {
  const connect$ = defer(() => connectInjectedExtension(name)).pipe(
    // PolkadotJS rejects the promise straight away instead of waiting for user input
    retry({
      delay(error) {
        if (error?.message.includes("pending authorization request")) {
          return timer(1000)
        }
        throw error
      },
    }),
    map((extension) => ({
      type: ConnectStatus.Connected as const,
      extension,
    })),
    catchError((ex) => {
      console.error(ex)
      return of({ type: ConnectStatus.Disconnected as const })
    }),
    startWith({ type: ConnectStatus.Connecting as const }),
  )

  const connectWithCleanup$ = defer(() => {
    let disconnected = false
    let extension: InjectedExtension | null = null
    return concat(connect$, NEVER).pipe(
      tap({
        next(value) {
          if (value.type === ConnectStatus.Connected) {
            if (disconnected) {
              value.extension.disconnect()
            } else {
              extension = value.extension
            }
          }
        },
        unsubscribe() {
          if (extension) {
            extension.disconnect()
          } else {
            disconnected = true
          }
        },
      }),
    )
  })

  const initialSelected = extensionIsPreselected(name)
  return toggleExtension$(name).pipe(
    scan((acc) => !acc, initialSelected),
    startWith(initialSelected),
    switchMap((selected) =>
      selected
        ? connectWithCleanup$
        : of({
            type: ConnectStatus.Disconnected as const,
          }),
    ),
    tap((v) => {
      if (v.type === ConnectStatus.Connected) {
        setPreselectedExtension(name, true)
      } else if (v.type === ConnectStatus.Disconnected) {
        setPreselectedExtension(name, false)
      }
    }),
  )
}

export const extensions$ = state(combineKeys(availableExtensions$, extension$))

export const selectedExtensions$ = extensions$.pipeState(
  map(
    (extensions) =>
      new Map(
        [...extensions.entries()]
          .filter(([, v]) => v.type !== ConnectStatus.Disconnected)
          .map(([k, v]) => [
            k,
            v.type === ConnectStatus.Connected ? v.extension : null,
          ]),
      ),
  ),
  withDefault(new Map<string, InjectedExtension | null>()),
)

const extensionAccounts$ = state(
  (name: string) =>
    extension$(name).pipe(
      switchMap((x) => {
        if (x.type !== ConnectStatus.Connected) return of([])
        return new Observable<InjectedPolkadotAccount[]>((observer) =>
          x.extension.subscribe((accounts) => {
            observer.next(accounts)
          }),
        )
      }),
    ),
  [],
)

export const accountsByExtension$ = state(
  combineKeys(availableExtensions$, extensionAccounts$),
  new Map<string, InjectedPolkadotAccount[]>(),
)

export const getPublicKey = (address: string) => {
  const info = getSs58AddressInfo(address)
  return info.isValid ? info.publicKey : null
}
export const getAccountMapKey = (address: string) => {
  const pk = getPublicKey(address)
  return pk ? Binary.fromBytes(pk).asHex() : address
}

export const accounts$ = state(
  accountsByExtension$.pipe(
    map(
      (extensionAccounts) =>
        new Map(
          Array.from(extensionAccounts.entries()).flatMap(
            ([extension, accounts]) =>
              accounts.map((account) => [
                getAccountMapKey(account.address),
                {
                  ...account,
                  extension,
                },
              ]),
          ),
        ),
    ),
  ),
  new Map<string, InjectedPolkadotAccount & { extension: string }>(),
)

export const accountDetail$ = state(
  (account: string) =>
    accounts$.pipe(map((v) => v.get(getAccountMapKey(account)) ?? null)),
  null,
)
