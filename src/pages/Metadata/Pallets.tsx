import { CopyText } from "@/components/Copy"
import { SearchableSelect } from "@/components/Select"
import { UnifiedMetadata } from "@polkadot-api/substrate-bindings"
import { FC, Fragment, useState } from "react"
import { LookupLink } from "./Lookup"

type Pallet = UnifiedMetadata["pallets"][number]
export const Pallets: FC<{ pallets: Array<Pallet> }> = ({ pallets }) => {
  const [pallet, setPallet] = useState<Pallet | null>(null)

  return (
    <div className="border rounded p-2 flex flex-col gap-2">
      <label className="self-start">
        Pallet:{" "}
        <SearchableSelect
          value={pallet}
          setValue={setPallet}
          options={pallets.map((p) => ({
            text: p.name,
            value: p,
          }))}
        />
      </label>
      {pallet && (
        <Fragment key={pallet.name}>
          <p>Index: {pallet.index}</p>
          {pallet.storage && (
            <div>
              <h4>Storage</h4>
              <PalletStorage pallet={pallet} />
            </div>
          )}
          {pallet.constants.length > 0 && (
            <div>
              <h4>Constants</h4>
              <PalletConstants pallet={pallet} />
            </div>
          )}
          {pallet.viewFns.length > 0 && (
            <div>
              <h4>View Functions</h4>
              <PalletViewFns pallet={pallet} />
            </div>
          )}
          {pallet.calls != null && (
            <div>
              <h4>Calls</h4>
              <LookupLink id={pallet.calls.type} />
            </div>
          )}
          {pallet.events != null && (
            <div>
              <h4>Events</h4>
              <LookupLink id={pallet.events.type} />
            </div>
          )}
          {pallet.errors != null && (
            <div>
              <h4>Errors</h4>
              <LookupLink id={pallet.errors.type} />
            </div>
          )}
        </Fragment>
      )}
    </div>
  )
}

type StorageEntry = Pallet["storage"] extends
  | undefined
  | { items: Array<infer R> }
  ? R
  : never
const PalletStorage: FC<{ pallet: Pallet }> = ({ pallet }) => {
  const [entry, setEntry] = useState<StorageEntry | null>(null)

  if (!pallet.storage) return null

  const value =
    entry &&
    (entry.type.tag === "map" ? entry.type.value.value : entry.type.value)
  const key = entry && (entry.type.tag === "map" ? entry.type.value.key : null)
  const acceptsPartialKey =
    entry?.type.tag === "map" && entry.type.value.hashers.length > 1

  return (
    <div className="flex flex-col p-2 gap-2">
      <label className="self-start">
        Entry:{" "}
        <SearchableSelect
          value={entry}
          setValue={setEntry}
          options={pallet.storage.items.map((s) => ({
            text: s.name,
            value: s,
          }))}
        />
      </label>
      {entry && (
        <>
          {key != null && (
            <div>
              <h4>
                Key{" "}
                {entry && entry.type.tag === "map" ? (
                  <>({entry.type.value.hashers.map((x) => x.tag).join(", ")})</>
                ) : null}
              </h4>
              {acceptsPartialKey && <p>Accepts partial keys</p>}
              <LookupLink id={key} />
            </div>
          )}
          <div>
            <h4>Value</h4>
            <LookupLink id={value!} />
          </div>
          <div>
            <h4>Fallback</h4>
            <div className="whitespace-nowrap overflow-hidden text-ellipsis">
              <CopyText text={entry.fallback} binary className="mr-2" />
              {entry.fallback}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

type ConstantEntry = Pallet["constants"] extends Array<infer R> ? R : never
const PalletConstants: FC<{ pallet: Pallet }> = ({ pallet }) => {
  const [entry, setEntry] = useState<ConstantEntry | null>(null)

  if (!pallet.constants.length) return null

  return (
    <div className="flex flex-col p-2 gap-2">
      <label className="self-start">
        Entry:{" "}
        <SearchableSelect
          value={entry}
          setValue={setEntry}
          options={pallet.constants.map((c) => ({
            text: c.name,
            value: c,
          }))}
        />
      </label>
      {entry && (
        <>
          <div>
            <h4>Type</h4>
            <LookupLink id={entry.type} />
          </div>
          <div>
            <h4>Value</h4>
            <div className="whitespace-nowrap overflow-hidden text-ellipsis">
              <CopyText text={entry.value} binary className="mr-2" />
              {entry.value}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

type ViewFnEntry = Pallet["viewFns"] extends Array<infer R> ? R : never
const PalletViewFns: FC<{ pallet: Pallet }> = ({ pallet }) => {
  const [entry, setEntry] = useState<ViewFnEntry | null>(null)

  if (!pallet.viewFns.length) return null

  return (
    <div className="flex flex-col p-2 gap-2">
      <SearchableSelect
        value={entry}
        setValue={setEntry}
        options={pallet.viewFns.map((c) => ({
          text: c.name,
          value: c,
        }))}
      />
      {entry && (
        <>
          <div>
            <h4>Inputs</h4>
            <ol>
              {entry.inputs.map((input) => (
                <li key={input.name}>
                  <div>{input.name}</div>
                  <LookupLink id={input.type} />
                </li>
              ))}
            </ol>
          </div>
          <div>
            <h4>Output</h4>
            <LookupLink id={entry.output} />
          </div>
        </>
      )}
    </div>
  )
}
