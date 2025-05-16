import {
  getDynamicBuilder,
  MetadataLookup,
} from "@polkadot-api/metadata-builders"
import {
  AccountId,
  Bytes,
  enhanceDecoder,
  Enum,
  HexString,
  SS58String,
  StringRecord,
  Struct,
  u8,
  Variant,
} from "@polkadot-api/substrate-bindings"
import { Codec } from "polkadot-api"

export const createExtrinsicCodec = (
  dynamicBuilder: ReturnType<typeof getDynamicBuilder>,
  lookup: MetadataLookup,
) => {
  // https://spec.polkadot.network/id-extrinsics#id-extrinsics-body
  const extrinsicHeader = enhanceDecoder(u8.dec, (value) => ({
    signed: (value & 0x80) > 0,
    version: value & 0x7f,
  }))
  const sender =
    "address" in lookup.metadata.extrinsic
      ? (dynamicBuilder.buildDefinition(
          lookup.metadata.extrinsic.address,
        ) as Codec<
          // TODO Assume MultiAddress, but can be anything really :/
          | Enum<{
              Id: SS58String
            }>
          | SS58String
          | HexString
        >)
      : AccountId()
  const v14Signature = Variant({
    Ed25519: Bytes(64),
    Sr25519: Bytes(64),
    Ecdsa: Bytes(65),
  })
  const signature =
    "signature" in lookup.metadata.extrinsic
      ? (dynamicBuilder.buildDefinition(
          lookup.metadata.extrinsic.signature,
        ) as typeof v14Signature)
      : v14Signature
  const extra = Struct(
    Object.fromEntries(
      lookup.metadata.extrinsic.signedExtensions.map((ext) => [
        ext.identifier,
        dynamicBuilder.buildDefinition(ext.type),
      ]),
    ) as StringRecord<Codec<any>>,
  )
  const call = dynamicBuilder.buildDefinition(
    "call" in lookup.metadata.extrinsic
      ? lookup.metadata.extrinsic.call
      : lookup.metadata.extrinsic.type,
  ) as Codec<{ type: string; value: { type: string; value: unknown } }>
  const signedExtrinsicV4 = Struct({
    sender,
    signature,
    extra,
    call,
  })

  // Externally, it's an opaque
  return enhanceDecoder(Bytes().dec, (bytes: Uint8Array) => {
    const header = extrinsicHeader(bytes)

    if (header.signed) {
      const v4Payload = signedExtrinsicV4.dec(bytes.slice(1))
      return {
        version: header.version,
        signed: true as const,
        ...v4Payload,
        callData: call.enc(v4Payload.call),
      }
    }

    return {
      version: header.version,
      signed: false as const,
      call: call.dec(bytes.slice(1)),
      callData: bytes.slice(1),
    }
  })
}
export type DecodedExtrinsic = ReturnType<
  ReturnType<typeof createExtrinsicCodec>
>
