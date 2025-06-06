import { SearchableSelect } from "@/components/Select"
import { UnifiedMetadata } from "@polkadot-api/substrate-bindings"
import { FC, useState } from "react"
import { LookupLink } from "./Lookup"

type ExtrinsicDescriptor = UnifiedMetadata["extrinsic"]
export const Extrinsic: FC<{ extrinsic: ExtrinsicDescriptor }> = ({
  extrinsic,
}) => {
  return (
    <div className="border rounded p-2 flex flex-col gap-2">
      <p>
        Version{extrinsic.version.length > 1 ? "s" : ""}:{" "}
        {extrinsic.version.join(", ")}
      </p>
      {"type" in extrinsic && (
        <div>
          <h4>Type</h4>
          <LookupLink id={extrinsic.type} />
        </div>
      )}
      {"call" in extrinsic && (
        <div>
          <h4>Call</h4>
          <LookupLink id={extrinsic.call} />
        </div>
      )}
      {"signature" in extrinsic && (
        <div>
          <h4>Signature</h4>
          <LookupLink id={extrinsic.signature} />
        </div>
      )}
      {"address" in extrinsic && (
        <div>
          <h4>Address</h4>
          <LookupLink id={extrinsic.address} />
        </div>
      )}
      <div>
        <h4>Signed Extensions</h4>
        <SignedExtensions signedExtensions={extrinsic.signedExtensions} />
      </div>
    </div>
  )
}

type SignedExtension =
  ExtrinsicDescriptor["signedExtensions"] extends Array<infer R> ? R : never
const SignedExtensions: FC<{ signedExtensions: Array<SignedExtension> }> = ({
  signedExtensions,
}) => {
  const [entry, setEntry] = useState<SignedExtension | null>(null)

  return (
    <div className="flex flex-col p-2 gap-2">
      <label className="self-start">
        Identifier:{" "}
        <SearchableSelect
          value={entry}
          setValue={setEntry}
          options={signedExtensions.map((ext) => ({
            text: ext.identifier,
            value: ext,
          }))}
        />
      </label>
      {entry && (
        <>
          <div>
            <h5>Type</h5>
            <LookupLink id={entry.type} />
          </div>
          <div>
            <h5>Additional Signed</h5>
            <LookupLink id={entry.additionalSigned} />
          </div>
        </>
      )}
    </div>
  )
}
