import { CopyText } from "@/components/Copy"
import { ExpandBtn } from "@/components/Expand"
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
import { FC, ReactNode, useState } from "react"

export const DigestDetails: FC<{ header: BlockHeader }> = ({ header }) => {
  if (!header.digests.length) return <span className="text-slate-400">N/A</span>

  return (
    <ol className="divide-y divide-foreground/10">
      {header.digests.map((digest, idx) => (
        <DigestRow key={idx} digest={digest} />
      ))}
    </ol>
  )
}

const DigestRow: FC<{ digest: HeaderDigest }> = ({ digest }) => {
  const [expanded, setExpanded] = useState(false)
  const view = getDigestView(digest)
  const canExpand = view.details != null

  const rawValue =
    digest.type === "other"
      ? toHex(digest.value)
      : (digest.value?.payload ?? null)
  const engine = digest.type === "other" ? null : (digest.value?.engine ?? null)

  return (
    <li className="py-2.5 last:pb-0 space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:grid sm:grid-cols-[2rem_6rem_3rem_minmax(0,1fr)_auto] sm:gap-2">
        {canExpand ? (
          <div>
            <button
              className="flex h-6 w-6 items-center justify-center rounded-md text-foreground/55 hover:bg-foreground/5 hover:text-foreground"
              onClick={() => setExpanded((value) => !value)}
              title={expanded ? "Hide details" : "Show details"}
              type="button"
            >
              <ExpandBtn expanded={expanded} />
            </button>
          </div>
        ) : (
          <div />
        )}
        <div className="flex items-center gap-2">
          <DigestTypeLabel type={digest.type} />
        </div>
        <span className="font-mono text-sm text-foreground/75">
          {engine ?? "-"}
        </span>
        {view.summary ? (
          <div className="flex items-baseline gap-2 text-sm text-foreground">
            <span className="shrink-0 text-foreground/55">
              {view.summary.label}
            </span>
            {view.summary.value}
          </div>
        ) : (
          <div />
        )}
        <div className="text-sm hidden sm:block">
          {rawValue ? <HexDisplay value={rawValue} /> : null}
        </div>
      </div>

      {canExpand && expanded ? (
        <div className="rounded-md bg-foreground/5 px-3 py-2 sm:ml-48">
          {view.details}
          {/* <div className="grid gap-x-6 gap-y-1 md:grid-cols-2">
            {view.details.map((field, idx) => (
              <DigestDetailField key={idx} field={field} />
            ))}
          </div> */}
        </div>
      ) : null}
    </li>
  )
}

type DigestView = {
  summary: {
    label: string
    value: ReactNode
  } | null
  details: ReactNode | null
}

const getDigestView = (digest: HeaderDigest): DigestView => {
  if (digest.type === "other" || digest.type === "runtimeUpdated")
    return {
      summary: null,
      details: null,
    }

  const decoder = digestDecoders[digest.type][digest.value.engine]
  return (
    decoder?.(digest.value.payload) ?? {
      summary: null,
      details: null,
    }
  )
}

const digestDecoders: Record<
  string,
  Record<string, (payload: HexString) => DigestView | null>
> = {
  preRuntime: {
    BABE: (payload) => {
      const decoded = decodeBabePreRuntime(payload)
      if (!decoded) return null

      const digestValue =
        decoded.value && typeof decoded.value == "object"
          ? decoded.value
          : {
              authority_index: null,
              slot: null,
            }
      const vrf =
        decoded.value &&
        typeof decoded.value == "object" &&
        "vrf_signature" in decoded.value
          ? decoded.value.vrf_signature
          : null

      return {
        summary:
          digestValue.slot != null
            ? { label: "Slot", value: digestValue.slot.toString() }
            : { label: "Kind", value: decoded.type },
        details: (
          <FieldGrid
            fields={[
              { label: "Kind", value: decoded.type },
              digestValue.authority_index != null
                ? {
                    label: "Authority",
                    value: `#${digestValue.authority_index}`,
                  }
                : null,
              vrf
                ? {
                    label: "VRF output",
                    value: <HexDisplay value={toHex(vrf.pre_output)} />,
                  }
                : null,
              vrf
                ? {
                    label: "VRF proof",
                    value: <HexDisplay value={toHex(vrf.proof)} />,
                  }
                : null,
            ]}
          />
        ),
      }
    },
    aura: (payload) => {
      const decoded = decodeAuraPreRuntime(payload)
      return decoded
        ? {
            summary: { label: "Slot", value: decoded.slot.toString() },
            details: null,
          }
        : null
    },
    CMLS: (payload) => {
      const decoded = decodeCmlsPreRuntime(payload)
      if (!decoded) return null

      if (decoded.type === "BlockBundleInfo") {
        return {
          summary: { label: "Bundle", value: `#${decoded.value.index}` },
          details: (
            <FieldGrid
              fields={[
                {
                  label: "Is last",
                  value: decoded.value.isLast ? "Yes" : "No",
                },
              ]}
            />
          ),
        }
      }
      if (decoded.type === "CoreInfo") {
        return {
          summary: {
            label: "Core info selector",
            value: `${decoded.value.selector}`,
          },
          details: (
            <FieldGrid
              fields={[
                {
                  label: "Claim offset",
                  value: decoded.value.claimQueueOffset.toString(),
                },
                {
                  label: "Cores",
                  value: decoded.value.numberOfCores.toString(),
                },
              ]}
            />
          ),
        }
      }
      if (decoded.type === "RelayParent") {
        return {
          summary: {
            label: "Relay parent",
            value: <HexDisplay value={decoded.value} />,
          },
          details: null,
        }
      }
      return { summary: { label: "Kind", value: decoded.type }, details: null }
    },
    rand: (payload) => {
      const decoded = decodeRandVrfConsensus(payload)
      return decoded
        ? {
            summary: {
              label: "VRF output",
              value: <HexDisplay value={decoded.vrf_output} />,
            },
            details: (
              <FieldGrid
                fields={[
                  {
                    label: "VRF proof",
                    value: <HexDisplay value={decoded.vrf_proof} />,
                  },
                ]}
              />
            ),
          }
        : null
    },
  },
  consensus: {
    BEEF: (payload) => {
      const decoded = decodeBeefyConsensus(payload)
      if (!decoded) return null
      if (decoded.type === "AuthoritiesChange") {
        return {
          summary: {
            label: "AuthoritiesChange",
            value: decoded.value.id.toString(),
          },
          details: (
            <FieldList
              title="Validators"
              values={decoded.value.validators.map((hash) => (
                <HexDisplay value={hash} />
              ))}
            />
          )
        }
      }
      if (decoded.type === "MmrRoot") {
        return {
          summary: {
            label: "MMR root",
            value: <HexDisplay value={decoded.value} />,
          },
          details: null,
        }
      }
      if (decoded.type === "OnDisabled") {
        return {
          summary: { label: "OnDisabled", value: `#${decoded.value}` },
          details: null,
        }
      }
      return { summary: { label: "Kind", value: decoded.type }, details: null }
    },
    RPSR: (payload) => {
      const decoded = decodeRsprConsensus(payload)
      return decoded
        ? {
            summary: {
              label: "Relay block",
              value: decoded.blockNumber.toString(),
            },
            details: (
              <FieldGrid
                fields={[
                  {
                    label: "Storage root",
                    value: <HexDisplay value={decoded.storageRoot} />,
                  },
                ]}
              />
            ),
          }
        : null
    },
    fron: (payload) => {
      const decoded = decodeFrontierConsensus(payload)
      if (!decoded) return null
      if (decoded.type === "Hashes") {
        return {
          summary: {
            label: "Block Hash",
            value: <HexDisplay value={decoded.value.blockHash} />,
          },
          details: (
            <FieldList
              title="Tx Hashes"
              values={decoded.value.txHashes.map((hash) => (
                <HexDisplay value={hash} />
              ))}
            />
          ),
        }
      }
      return { summary: { label: "Kind", value: decoded.type }, details: [] }
    },
    ISMP: (payload) => {
      const decoded = decodeIsmpConsensus(payload)
      return decoded
        ? {
            summary: {
              label: "Child trie",
              value: <HexDisplay value={decoded.childTrieRoot} />,
            },
            details: (
              <FieldGrid
                fields={[
                  {
                    label: "MMR root",
                    value: <HexDisplay value={decoded.mmrRoot} />,
                  },
                ]}
              />
            ),
          }
        : null
    },
    ISTM: (payload) => {
      const decoded = decodeIsmpTimestampConsensus(payload)
      return decoded
        ? {
            summary: {
              label: "Timestamp",
              value: new Date(Number(decoded.timestamp) * 1000).toISOString(),
            },
            details: [],
          }
        : null
    },
  },
  seal: {
    // Generally, seals are just the raw signature
  },
}

const FieldGrid: FC<{
  fields: Array<{
    label: string
    value: ReactNode
  } | null>
}> = ({ fields }) => (
  <div className="grid gap-x-6 gap-y-1 md:grid-cols-2">
    {fields.map((field, idx) =>
      field ? <DigestDetailField key={idx} field={field} /> : null,
    )}
  </div>
)

const FieldList: FC<{
  title: string
  values: Array<ReactNode>
}> = ({ title, values }) => (
  <div className="space-y-2">
    <div className="text-xs font-medium uppercase tracking-wide">{title}</div>
    {values.length ? (
      <ol className="list-decimal space-y-1 pl-5">
        {values.map((value, i) => (
          <li key={i}>{value}</li>
        ))}
      </ol>
    ) : (
      <div className="text-sm text-foreground/50">(Empty)</div>
    )}
  </div>
)

const DigestDetailField: FC<{ field: { label: string; value: ReactNode } }> = ({
  field,
}) => (
  <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-baseline gap-2 text-sm">
    <span className="text-foreground/55">{field.label}</span>
    {field.value}
  </div>
)

const HexDisplay: FC<{ value: HexString }> = ({ value }) => (
  <span className="flex items-center gap-1">
    <span className="truncate font-mono">{shortStr(value, 8)}</span>
    <CopyText className="shrink-0 text-foreground" text={value} binary={true} />
  </span>
)

const formatDigestType = (type: string) =>
  type === "preRuntime"
    ? "pre-runtime"
    : type === "runtimeUpdated"
      ? "runtime updated"
      : type
const DigestTypeLabel: FC<{ type: string }> = ({ type }) => (
  <span className="w-fit whitespace-nowrap rounded-md border border-foreground/15 bg-foreground/5 px-2 py-0.5 text-xs font-medium text-foreground/75">
    {formatDigestType(type)}
  </span>
)

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
