import { CopyText } from "@/components/Copy"
import { shortStr } from "@/utils"
import {
  _void,
  bool,
  Bytes,
  Codec,
  compactNumber,
  Hex,
  Struct,
  u32,
  u64,
  u8,
  Variant,
  Vector,
} from "@polkadot-api/substrate-bindings"
import { BlockHeader, HexString } from "polkadot-api"
import { toHex } from "polkadot-api/utils"
import { FC, ReactNode } from "react"

const HeaderBadge: FC<{ children: ReactNode }> = ({ children }) => (
  <span className="inline-flex items-center rounded-md border border-polkadot/30 bg-polkadot/10 px-2 py-1 text-xs font-medium text-polkadot">
    {children}
  </span>
)

export const DigestDetails: FC<{ header: BlockHeader }> = ({ header }) => {
  if (!header.digests.length) return <span className="text-slate-400">N/A</span>

  return (
    <div className="overflow-x-auto">
      <div className="grid grid-cols-[8rem_5rem_minmax(12rem,1fr)_minmax(14rem,1fr)] gap-3 border-b border-foreground/10 pb-2 text-xs uppercase tracking-widest text-foreground/45">
        <span>Type</span>
        <span>Engine</span>
        <span>Decoded</span>
        <span>Raw</span>
      </div>
      <ol className="divide-y divide-foreground/10">
        {header.digests.map((digest, idx) => (
          <DigestRow key={idx} digest={digest} />
        ))}
      </ol>
    </div>
  )
}

const DigestRow: FC<{ digest: HeaderDigest }> = ({ digest }) => {
  const engine =
    "value" in digest &&
    typeof digest.value === "object" &&
    "engine" in digest.value
      ? digest.value.engine
      : null

  return (
    <li className="grid grid-cols-[8rem_5rem_minmax(12rem,1fr)_minmax(14rem,1fr)] items-center gap-3 py-3 last:pb-0">
      <DigestTypeLabel type={digest.type} />
      <span className="font-mono text-sm text-foreground/80">
        {engine ?? "-"}
      </span>
      <div className="min-w-0">
        <DigestDecodedFields digest={digest} />
      </div>
      <div className="min-w-0">
        <DigestRawPayload digest={digest} />
      </div>
    </li>
  )
}

const DigestDecodedFields: FC<{ digest: HeaderDigest }> = ({ digest }) => {
  switch (digest.type) {
    case "preRuntime":
      return <PreRuntimeDigestFields value={digest.value} />
    case "consensus":
      return <ConsensusDigestFields value={digest.value} />
    default:
      return <span className="text-sm text-foreground/45">-</span>
  }
}

const PreRuntimeDigestFields: FC<{
  value: {
    engine: string
    payload: HexString
  }
}> = ({ value }) => {
  if (value.engine === "BABE") {
    const decoded = decodeBabePreRuntime(value.payload)
    if (decoded) {
      const { authority_index: authorityIndex, slot } =
        typeof decoded.value == "object"
          ? decoded.value
          : {
              authority_index: null,
              slot: null,
            }
      const vrf =
        typeof decoded.value == "object" && "vrf_signature" in decoded.value
          ? decoded.value.vrf_signature
          : null

      return (
        <div className="space-y-1">
          {decoded.type && <DigestField label="Kind" value={decoded.type} />}
          {authorityIndex != null && (
            <DigestField label="Authority index" value={`#${authorityIndex}`} />
          )}
          {slot != null && <DigestField label="Slot" value={slot.toString()} />}
          {vrf && (
            <>
              <DigestPayload label="VRF output" value={toHex(vrf.pre_output)} />
              <DigestPayload label="VRF proof" value={toHex(vrf.proof)} />
            </>
          )}
        </div>
      )
    }
  }

  if (value.engine === "aura") {
    const decoded = decodeAuraPreRuntime(value.payload)
    if (decoded) {
      return <DigestField label="Slot" value={decoded.slot.toString()} />
    }
  }

  if (value.engine === "CMLS") {
    const decoded = decodeCmlsPreRuntime(value.payload)
    if (decoded)
      return (
        <div className="space-y-1">
          {decoded.type && <DigestField label="Kind" value={decoded.type} />}
          {decoded.type === "BlockBundleInfo" ? (
            <>
              <DigestField label="Index" value={decoded.value.index} />
              <DigestField
                label="Is last"
                value={decoded.value.isLast ? "Yes" : "No"}
              />
            </>
          ) : null}
          {decoded.type === "CoreInfo" ? (
            <>
              <DigestField label="Selector" value={decoded.value.selector} />
              <DigestField
                label="Claim Queue Offset"
                value={decoded.value.claimQueueOffset}
              />
              <DigestField
                label="Num. of cores"
                value={decoded.value.numberOfCores}
              />
            </>
          ) : null}
          {decoded.type === "RelayParent" ? (
            <>
              <DigestField label="Hash" value={decoded.value} />
            </>
          ) : null}
        </div>
      )
  }

  if (value.engine === "rand") {
    const decoded = decodeRandVrfConsensus(value.payload)
    if (decoded)
      return (
        <div className="space-y-1">
          <DigestPayload label="VRF output" value={decoded.vrf_output} />
          <DigestPayload label="VRF proof" value={decoded.vrf_proof} />
        </div>
      )
  }

  return <span className="text-sm text-foreground/45">-</span>
}

const ConsensusDigestFields: FC<{
  value: {
    engine: string
    payload: HexString
  }
}> = ({ value }) => {
  if (value.engine === "BEEF") {
    const decoded = decodeBeefyConsensus(value.payload)
    if (decoded)
      return (
        <div className="space-y-1">
          {decoded.type && <DigestField label="Kind" value={decoded.type} />}
          {decoded.type === "AuthoritiesChange" ? (
            <>
              <DigestField label="Id" value={decoded.value.id} />
              {/* TODO validators? */}
            </>
          ) : null}
          {decoded.type === "MmrRoot" ? (
            <>
              <DigestPayload label="Root Hash" value={decoded.value} />
            </>
          ) : null}
          {decoded.type === "OnDisabled" ? (
            <>
              <DigestPayload
                label="Authority Index"
                value={decoded.value.toString()}
              />
            </>
          ) : null}
        </div>
      )
  }
  if (value.engine === "RPSR") {
    const decoded = decodeRsprConsensus(value.payload)
    console.log(decoded)
    if (decoded)
      return (
        <div className="space-y-1">
          <DigestPayload label="Storage Root" value={decoded.storageRoot} />
          <DigestPayload
            label="Block number"
            value={decoded.blockNumber.toString()}
          />
        </div>
      )
  }
  if (value.engine === "fron") {
    // Hydration, Moonbeam
    const decoded = decodeFrontierConsensus(value.payload)
    if (decoded)
      return (
        <div className="space-y-1">
          {decoded.type && <DigestField label="Kind" value={decoded.type} />}
          {decoded.type === "Hashes" ? (
            <>
              <DigestPayload label="Block" value={decoded.value.blockHash} />
              {/* TODO txHashes */}
            </>
          ) : null}
        </div>
      )
  }
  if (value.engine === "ISMP") {
    // Bifrost
    const decoded = decodeIsmpConsensus(value.payload)
    if (decoded)
      return (
        <div className="space-y-1">
          <DigestPayload label="MMR Root" value={decoded.mmrRoot} />
          <DigestPayload label="Child Trie" value={decoded.childTrieRoot} />
        </div>
      )
  }
  if (value.engine === "ISTM") {
    // Bifrost
    const decoded = decodeIsmpTimestampConsensus(value.payload)
    if (decoded)
      return (
        <div className="space-y-1">
          <DigestField
            label="Timestamp"
            value={new Date(Number(decoded.timestamp) * 1000).toISOString()}
          />
        </div>
      )
  }
  return <span className="text-sm text-foreground/45">-</span>
}

const DigestRawPayload: FC<{ digest: HeaderDigest }> = ({ digest }) => {
  const payload = getDigestPayload(digest)
  if (!payload) return <span className="text-sm text-foreground/45">-</span>

  return <RawDigestPayload value={payload} />
}

const DigestField: FC<{ label: string; value: ReactNode }> = ({
  label,
  value,
}) => (
  <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-2 text-sm">
    <span className="text-foreground/55">{label}</span>
    <span className="min-w-0 truncate font-mono text-foreground">{value}</span>
  </div>
)

const DigestPayload: FC<{ label: string; value: string }> = ({
  label,
  value,
}) => (
  <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-2 text-sm">
    <span className="text-foreground/55">{label}</span>
    <span className="flex min-w-0 items-center gap-1">
      <span className="min-w-0 truncate font-mono text-foreground">
        {shortStr(value, 8)}
      </span>
      <CopyText className="shrink-0 text-foreground/65" text={value} binary />
    </span>
  </div>
)

const RawDigestPayload: FC<{ value: string }> = ({ value }) => (
  <span className="flex min-w-0 items-center gap-1 text-sm">
    <span className="min-w-0 truncate font-mono text-foreground">
      {shortStr(value, 8)}
    </span>
    <CopyText className="shrink-0 text-foreground/65" text={value} binary />
  </span>
)

const formatDigestType = (type: string) =>
  type === "preRuntime"
    ? "pre-runtime"
    : type === "runtimeUpdated"
      ? "runtime updated"
      : type
const DigestTypeLabel: FC<{ type: string }> = ({ type }) => (
  <span className="w-fit rounded-md border border-foreground/15 bg-foreground/5 px-2 py-0.5 text-xs font-medium text-foreground/75">
    {formatDigestType(type)}
  </span>
)

const getDigestPayload = (digest: HeaderDigest): HexString | null => {
  switch (digest.type) {
    case "preRuntime":
    case "seal":
    case "consensus":
      return digest.value.payload
    case "other":
      return toHex(digest.value)
    default:
      return null
  }
}

type HeaderDigest = BlockHeader["digests"][number]

const createDecodeDigestFn =
  <T,>(codec: Codec<T>) =>
  (payload: HexString) => {
    try {
      return codec.dec(payload)
    } catch (ex) {
      console.error(ex)
      return null
    }
  }

const DigestWithVRF = Struct({
  authority_index: u32,
  slot: u64,
  vrf_signature: Struct({
    pre_output: Bytes(32),
    proof: Bytes(64),
  }),
})
const BabePreDigest = Variant({
  Unknown: _void,
  Primary: DigestWithVRF,
  SecondaryPlain: Struct({
    authority_index: u32,
    slot: u64,
  }),
  SecondaryVRF: DigestWithVRF,
})
export const decodeBabePreRuntime = createDecodeDigestFn(BabePreDigest)

const AuraDigest = Struct({
  slot: u64,
})
export const decodeAuraPreRuntime = createDecodeDigestFn(AuraDigest)

const ClmsDigestItem = Variant({
  RelayParent: Hex(32),
  CoreInfo: Struct({
    selector: u8,
    claimQueueOffset: u8,
    numberOfCores: compactNumber,
  }),
  BlockBundleInfo: Struct({
    index: u8,
    isLast: bool,
  }),
  UseFullCore: _void,
})
const decodeCmlsPreRuntime = createDecodeDigestFn(ClmsDigestItem)

const RandVRFPreDigest = Struct({
  vrf_output: Hex(32),
  vrf_proof: Hex(64),
})
const decodeRandVrfConsensus = createDecodeDigestFn(RandVRFPreDigest)

const BeefyConsensusLog = Variant({
  Unknown: _void,
  AuthoritiesChange: Struct({
    validators: Vector(Hex(33)),
    id: u64,
  }),
  OnDisabled: u32,
  MmrRoot: Hex(32),
})
const decodeBeefyConsensus = createDecodeDigestFn(BeefyConsensusLog)

const RsprConsensusLog = Struct({
  storageRoot: Hex(32),
  blockNumber: compactNumber,
})
const decodeRsprConsensus = createDecodeDigestFn(RsprConsensusLog)

const FrontierConsensusLog = Variant({
  Unknown: _void,
  Hashes: Struct({
    blockHash: Hex(32),
    txHashes: Vector(Hex(32)),
  }),
  // It's actually an ethereum block header, might be too long
  Block: _void,
})
const decodeFrontierConsensus = createDecodeDigestFn(FrontierConsensusLog)

const IsmpConsensusDigest = Struct({
  mmrRoot: Hex(32),
  childTrieRoot: Hex(32),
})
const decodeIsmpConsensus = createDecodeDigestFn(IsmpConsensusDigest)

const IsmpTimestampDigest = Struct({
  timestamp: u64,
})
const decodeIsmpTimestampConsensus = createDecodeDigestFn(IsmpTimestampDigest)
