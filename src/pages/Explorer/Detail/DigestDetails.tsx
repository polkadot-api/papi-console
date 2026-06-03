import { ExpandBtn } from "@/components/Expand"
import { BlockHeader, HexString } from "polkadot-api"
import { toHex } from "polkadot-api/utils"
import { FC, ReactNode, useState } from "react"
import { auraPreDigest } from "./digests/aura"
import { babePreDigest } from "./digests/babe"
import { beefyConsensus } from "./digests/beef"
import { cmlsPreDigest } from "./digests/cmls"
import { HexDisplay } from "./digests/components"
import { fronConsensus } from "./digests/fron"
import { ismpConsensus } from "./digests/ismp"
import { istmConsensus } from "./digests/istm"
import { randPreDigest } from "./digests/rand"
import { rsprConsensus } from "./digests/rspr"

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
    BABE: babePreDigest,
    aura: auraPreDigest,
    CMLS: cmlsPreDigest,
    rand: randPreDigest,
  },
  consensus: {
    BEEF: beefyConsensus,
    RPSR: rsprConsensus,
    fron: fronConsensus,
    ISMP: ismpConsensus,
    ISTM: istmConsensus,
  },
  seal: {
    // Generally, seals are just the raw signature
  },
}

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
